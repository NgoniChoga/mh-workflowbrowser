'use strict';

// Utility object for dealing with time and timestamps.

function createTimeManager(){
  
  var oneHourInMs=60*60*1000;
  var twentyFourHoursInMs = 24*oneHourInMs;
  var lateTrimHours = arguments.lateTrimHours || 7;
  var lateTrimMs = lateTrimHours*oneHourInMs;

  function toHHMMSS(secNum) {
    var hours   = Math.floor(secNum / 3600);
    var minutes = Math.floor((secNum - (hours * 3600)) / 60);
    var seconds = Math.floor(secNum - (hours * 3600) - (minutes * 60));
    if (hours   < 10) {hours   = '0'+hours;}
    if (minutes < 10) {minutes = '0'+minutes;}
    if (seconds < 10) {seconds = '0'+seconds;}
    var time    = hours+':'+minutes+':'+seconds;
    return time;
  }

  function makeMidnight(date){
      date.setHours(0);
      date.setMinutes(0);
      date.setSeconds(0);
      return date;
  }

  function updateTimeSpan(parentSpan,span) {
      if (span.hasOwnProperty('dateStarted')) {
        if (parentSpan.dateStarted === null ||
            span.dateStarted < parentSpan.dateStarted ) {
          parentSpan.dateStarted = span.dateStarted;
        }
      }
      if (span.hasOwnProperty('dateCompleted')){
        if (parentSpan.dateCompleted === null ||
            span.dateCompleted > parentSpan.dateCompleted ) {
          parentSpan.dateCompleted = span.dateCompleted;
        }
      }
    }

  function useOneTimestampForBothEndsIfThatsAllWeHave(span){
      if (! (span.hasOwnProperty('dateStarted') &&
             span.hasOwnProperty('dateCompleted'))  ) {
        if (span.hasOwnProperty('dateCompleted') ){
          span.dateStarted = span.dateCompleted;
        }
        if (span.hasOwnProperty('dateStarted')) {
          span.dateCompleted = span.dateStarted;
        }
      }
  }

  function setOperationDates(wfb,object) {
      if (object.hasOwnProperty('started')){
        object.dateStarted = new Date(object.started);
      }
      if (object.hasOwnProperty('completed')) {
        object.dateCompleted = new Date(object.completed);
      }
      useOneTimestampForBothEndsIfThatsAllWeHave(object);
      // danger, side effect...
      updateTimeSpan(wfb,object);
    }

  function setJobDates(job){
    if (_.has(job,'dateStarted')){
      job.dateStarted = new Date(job.dateStarted);
    }
    if (_.has(job,'dateCompleted')){
      job.dateCompleted = new Date(job.dateCompleted);
    }
    useOneTimestampForBothEndsIfThatsAllWeHave(job);
    job.duration = job.dateCompleted.getTime() - job.dateStarted.getTime();
  }

  function calculateOffHoursAndMidnights(wfb,offHours,midnights){
  	var oh ={};
  	oh.dateCompleted = wfb.dateCompleted;
  	var d = new Date(wfb.dateStarted.getTime());
  	while (oh.dateCompleted <= wfb.dateCompleted) {
  	  oh = {};
  	  oh.dateStarted   = new Date(d.getTime());
  	  oh.dateStarted.setHours(17);   // 5 pm
  	  oh.dateCompleted = new Date(d.getTime());
  	  oh.dateCompleted.setHours(24); // 24 makes it next day
  	  oh.dateCompleted.setHours(9);  // 9 am
  	  d = oh.dateCompleted;
  	  offHours.push(oh);
  	  midnights.push(makeMidnight(new Date(oh.dateStarted.getTime())));
  	}
  	midnights.push(makeMidnight(new Date(oh.dateCompleted.getTime())));
  }

  function readConfigVal(hash){
    // Matterhorn emits keys with $. Mongo doesn't like $.
    // So we replace with underscore.
    return hash.$ || hash._;
  }


  function attachScheduledDuration(w){
    if (w.hasOwnProperty('configurations') &&
        w.configurations.hasOwnProperty('configuration')) {
      $.each(w.configurations.configuration, function(i,c) {
        var value = readConfigVal(c);
        if ( c.key === 'schedule.start' ) {
          w.scheduleStart = new Date(value/1);
        } else if ( c.key === 'schedule.stop' ) {
          w.scheduleStop  = new Date(value/1);
        } else if ( c.key === 'event.location' ) {
          w.eventLocation = value;
        }
      });
    }
    if (w.hasOwnProperty('scheduleStart') &&
        w.hasOwnProperty('scheduleStop') ) {
      w.scheduledDuration = w.scheduleStop.getTime() - w.scheduleStart.getTime();
    }
  }

  function getDateAvailable(workflow){
    var dateAvailable = null;
    $.each(workflow.operations,function(i,operation){
      if (operation.id === 'publish-engage' && operation.description.includes('external')) {
        dateAvailable = operation.dateCompleted;
        return;
      }
    });
    return dateAvailable;
  }

  function getDateReadyForTrim(workflow){
    var dateReadyForTrim = null;
    $.each(workflow.operations,function(i,operation){
      if (operation.id === 'send-email' && operation.description.includes('holding for edit')){
        if ( (!dateReadyForTrim) || (operation.dateCompleted && (dateReadyForTrim.getTime() > operation.dateCompleted.getTime())) ) {          
          dateReadyForTrim = operation.dateCompleted;
        }
      }
    });
    return dateReadyForTrim;
  }

  function setWorkflowDateAvailables(workflows){
    $.each(workflows,function(i,workflow){
      workflow.dateAvailable = getDateAvailable(workflow);
      workflow.dateReadyForTrim = getDateReadyForTrim(workflow);
      if ( workflow.dateAvailable && workflow.hasOwnProperty('scheduleStart')) {
        workflow.classStartToAvailableDuration =
          workflow.dateAvailable.getTime() - workflow.scheduleStart.getTime();
      }
       if ( workflow.dateReadyForTrim && workflow.hasOwnProperty('scheduleStart')) {
        workflow.untilReadyForTrimDuration =
          workflow.dateReadyForTrim.getTime() - workflow.scheduleStart.getTime();
      }
    });
  }

  function setWorkflow24HourMarks(workflows,workflow24HourMarks) {
      $.each(workflows,function(i,workflow){
        if (workflow.hasOwnProperty('scheduleStart') ) {
          if ( workflow.dateAvailable ) {
            if (workflow.classStartToAvailableDuration > twentyFourHoursInMs) {
              var startPlus24 = new Date(
                workflow.dateStarted.getTime()+twentyFourHoursInMs);
              var mark = {'date': startPlus24, 'row': workflow.row };
              workflow24HourMarks.push(mark);
            }
          }
        }
      });
    }

   function setLateTrimMarks(workflows,lateTrimMarks) {
      $.each(workflows,function(i,workflow){
        if (workflow.hasOwnProperty('scheduleStart') ) {
          if ( workflow.dateReadyForTrim ) {
            if (workflow.untilReadyForTrimDuration > lateTrimMs) {
              var startPlusLateTrimMs = new Date(
                workflow.scheduleStart.getTime()+lateTrimMs);
              var mark = {'date': startPlusLateTrimMs, 'row': workflow.row };
              lateTrimMarks.push(mark);
            }
          }
        }
      });
    }

  return  {
    'lateTrimHours':lateTrimHours,
    'lateTrimMs':lateTrimMs,
    'makeMidnight':makeMidnight,
    'oneHourInMs':oneHourInMs,
    'setOperationDates':setOperationDates,
    'setJobDates': setJobDates,
    'toHHMMSS':toHHMMSS,
    'twentyFourHoursInMs':twentyFourHoursInMs,
    'setLateTrimMarks':setLateTrimMarks,
    'setWorkflow24HourMarks':setWorkflow24HourMarks,
    'calculateOffHoursAndMidnights':calculateOffHoursAndMidnights,
    'attachScheduledDuration' : attachScheduledDuration,
    'setWorkflowDateAvailables':setWorkflowDateAvailables
  };
}


module.exports= {
  'createTimeManager': createTimeManager
};
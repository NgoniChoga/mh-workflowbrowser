## Synopsis

The Matterhorn Workflow Browser (WFB) is an interactive d3 based javascript visualization optimized for relative small (a few hundred) chunks of Matterhorn "workflow instances." Users may zoom, pan, and filter by a variety of criteria. Mouse over an element for more information, click on an element to link back to the corresponding page in the Matterhorn admin UI.

A workflow instance (set of videos and metadata passing through the system) is represented as series of operations (fat boxes) linked together by a thin line. Operations are color coded by type ("compose", "archive," etc.). Due to the current limitations of the MH workflow api, some operations are missing start or stop times ("capture" and "ingest").  

The browser accepts Matterhorn workflow endpoint json as input, samples of which may be found in the app data directory. Not that the WFB is a client-side only widget, so the endpoint json will have to be retrieved by an intermediate process that handles authentication, either via a simple cronjob to generate flat files (the way we are currently using it, using pyhorn the last 300 workflows every 10 minutes), or by embedding it in a dynamic webapp (as we plan to).

The WFB is pre-alpha software very much tailored to our specific concerns here at Harvard DCE, but we're releasing it in the hope that it might be useful to others as a starting point for their own visual exporations of workflow data.

## Build and run on sample data

Make sure you have installed npm, bower, and grunt.

Then clone this repo.

cd into the root directory

npm install

bower update

grunt 

grunt serve

This should open a web browser pointed at the WFB on some sample data.

Then plop the contents of the generated dist directory on your webserver, and diddle with the configuration in index.html as described below.

At some point (very!) soon I will figure out how to distribute the WFB via bower.

## Configuration

See the sample index.html file for a working example.






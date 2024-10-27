/**********************************************************************
* 
*
*
**********************************************************************/
// Pre-setup...

// nw.js: add node_modules path outside of the packed nwjs code...
//
// This keeps the large node module set outside the zip thus speeding
// up the loading process significantly...
if((typeof(process) != 'undefined' ? process : {}).__nwjs){
	var path = require('path')
	require('app-module-path')
		.addPath(path.dirname(process.execPath) + '/node_modules/') }



/*********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var utildom = require('lib/util-dom')
var viewer = require('imagegrid/viewer')



/*********************************************************************/

// NOTE: wrapped in a function to be run on body load...
$(function(){

	try {
		// setup actions...
		window.ig = 
		window.ImageGrid = 
			// XXX should this be core???
			viewer.ImageGridFeatures
				.setup([
					'imagegrid-testing',

					'demo',

					// XXX this is not for production...
					'experiments',

					//'-commandline',
					//'-ui-partial-ribbons',
				])

		window.ImageGridFeatures = viewer.ImageGridFeatures

	} catch(err){
		console.error(err)
		//throw err
		return }


	// used to switch experimental actions on (set to true) or off (unset or false)...
	//ig.experimental = true


	// report stuff...
	/*
	console.log('Loaded features:',
		ig.features.features)
	console.log('Disabled features:', 
		ig.features.disabled)
	console.log('Not applicable features:', 
		ig.features.unapplicable)

	ig.features.excluded.length > 0 
		&& console.warn('Excluded features:',
			ig.features.excluded)
	//*/

	// NOTE: fatal errors will get reported by setup...
	if(ig.features.error){
		var err = ig.features.error
		err.missing_suggested.length > 0
			&& console.warn('Missing suggested features:', 
				err.missing_suggested)
		err.missing.length > 0
			&& console.warn('Missing dependencies:', 
				err.missing) }


	// setup the viewer...
	ig
		.load({ viewer: $('.viewer') })
		.start()
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })

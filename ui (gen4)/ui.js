/**********************************************************************
* 
*
*
**********************************************************************/

window.nodejs = (typeof(process) === 'object' && process.features.uv) 
	? {
		require: window.require,
	} 
	: null


// Add node_modules path outside of the packed nwjs code...
//
// This keeps the large node module set outside the zip thus speeding
// up the loading process significantly...
if(window.process || global.process && process.__nwjs){
	var path = require('path')
	require('app-module-path')
		.addPath(path.dirname(process.execPath) + '/node_modules/')
}


// XXX for some reason requirejs does not fall back to node's require...
if(nodejs){
	var requirejs = require('requirejs')

	requirejs.config({
		nodeRequire: require,
		//baseUrl: __dirname,

		// XXX this does not work on direct filesystem access...
		//urlArgs: 'bust='+Date.now(),
	})
}



define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

var keyboard = require('lib/keyboard')
var doc = keyboard.doc

// compatibility...
var browser = require('browser')
var nw = require('nw')

// XXX load only the actualy used here modules...
var actions = require('lib/actions')
var data = require('data')
var ribbons = require('ribbons')

var viewer = require('viewer')

//var promise = require('promise')



/*********************************************************************/

$(function(){

	// list all loaded modules...
	var m = requirejs.s.contexts._.defined
	m = Object.keys(m).filter(function(e){ return m[e] != null })
	console.log('Modules (%d):', m.length, m)


	// setup actions...
	window.a = viewer.ImageGridFeatures
		.setup([
			'viewer-testing',

			'demo',

			// XXX this is not for production...
			'experiments',
		])


	// used to switch experimental actions on (set to true) or off (unset or false)...
	//a.experimental = true


	// report stuff...
	// XXX we also have .conflicts and .missing
	a.features.excluded.length > 0 
		&& console.warn('Features excluded (%d):',
			a.features.excluded.length, 
			a.features.excluded)
	console.log('Features not applicable (%d):', 
		a.features.unapplicable.length, 
		a.features.unapplicable)
	console.log('Features loaded (%d):',
		a.features.features.length, 
		a.features.features)

	a.logger = a.logger || {emit: function(e, v){ console.log('    ', e, v) }}


	// setup the viewer...
	a
		.load({ viewer: $('.viewer') })
		.setEmptyMsg('Loading...')
		.start()


	// load some testing data if nothing else loaded...
	if(!a.url_history || Object.keys(a.url_history).length == 0){
		// NOTE: we can (and do) load this in parts...
		a.loadDemoIndex()

			// this is needed when loading legacy sources that do not have tags
			// synced...
			// do not do for actual data...
			//.syncTags()
	}


	// XXX calling a.clear() does not display this...
	a.setEmptyMsg(
		'Nothing loaded...',
		'Press \'O\' to load, \'F1\' for help or \'?\' for keyboard mappings.')

})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })

/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true


//var ui = require('./ui')

var requirejs = require('requirejs')
requirejs.config({
	nodeRequire: require,
	//baseUrl: __dirname,

	// XXX this does not work on direct filesystem access...
	//urlArgs: 'bust='+Date.now(),
})

// XXX load only the actualy used here modules...
var actions = requirejs('lib/actions')
var data = requirejs('data')
var ribbons = requirejs('ribbons')


// XXX 
var testing = requirejs('testing')


var client = requirejs('client')

var viewer = requirejs('viewer')



/*********************************************************************/




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */

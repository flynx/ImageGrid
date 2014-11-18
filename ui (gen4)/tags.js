/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}
console.log('>>> tags')

//var DEBUG = DEBUG != null ? DEBUG : true

var object = require('object')



/*********************************************************************/

var TagsClassPrototype = {}


var TagsPrototype = {
	loadJSON: function(json){
	},
	dumpJSON: function(){
	},

	_reset: function(){
	},
}


/*********************************************************************/

var Tags =
module.Tags = 
object.makeConstructor('Tags', 
		TagsClassPrototype, 
		TagsPrototype)



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })

/**********************************************************************
* 
* Features:
* 	- tag paths
* 		a/b/c
* 	- tag sets/relations
* 		a:b
* 	- serializable tag queries
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var object = require('lib/object')
var util = require('lib/util')



/*********************************************************************/

var TagsClassPrototype = {
}


// XXX this should have the following sections:
// 		- tag-tag relations -- persistent
// 			- tags
// 			- paths
// 			- sets/relations
// 		- content (tag-object) -- volatile
// 			- tags
// 			- paths
// 			- sets/relations
// 			- tag-object references
var TagsPrototype = {

	// Add/Remove/Modify tags API...
	// XXX
	path: function(){
		// XXX
		return this
	},
	alias: function(){
		// XXX
		return this
	},


	// Add/Remove/Modify content API...
	// XXX
	tag: function(){
		// XXX
		return this
	},
	untag: function(){
		// XXX
		return this
	},
	

	// Query API...
	// XXX
	get: function(){
	},


	// Object utility API...
	//
	// 	.clone()
	// 	.clone('full')
	// 		-> tags
	//
	// 	.clone('tags')
	// 		-> tags
	//
	clone: function(mode){
		return new this.constructor(this.json(mode)) },

	// serialization...
	//
	// 	.json()
	// 	.json('full')
	// 		-> json
	//
	// 	.json('tags')
	// 		-> json
	//
	//
	// Format:
	// 	{
	// 	}
	//
	json: function(mode){
		// XXX
	},
	load: function(json){
		// XXX
		return this
	},

	// constructor...
	__init__: function(json){
		json 
			&& this.load(json) },
}


var Tags = 
module.Tags = 
object.makeConstructor('Tags', 
		TagssClassPrototype, 
		TagsPrototype)



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })

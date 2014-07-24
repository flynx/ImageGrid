/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}
console.log('>>> images')

//var DEBUG = DEBUG != null ? DEBUG : true



/*********************************************************************/

var ImagesClassPrototype =
module.ImagesClassPrototype = {

}


var ImagesPrototype =
module.ImagesPrototype = {

	loadJSON: function(data){
	},
	dumpJSON: function(data){
	},

	_reset: function(){
	},
}



/*********************************************************************/

// Main Images object...
//
var Images = 
module.Images =
function Images(json){
	// in case this is called as a function (without new)...
	if(this.constructor.name != 'Images'){
		return new Images(json)
	}

	// load initial state...
	if(json != null){
		this.loadJSON(json)
	} else {
		this._reset()
	}

	return this
}
Images.__proto__ = ImagesClassPrototype
Images.prototype = ImagesPrototype
Images.prototype.constructor = Images



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })

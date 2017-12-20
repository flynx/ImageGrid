/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var toggler = require('../toggler')
var keyboard = require('../keyboard')
var object = require('../object')
var widget = require('./widget')



/*********************************************************************/
// XXX general design:
// 		- each of these can take either a value or a function (constructor)
//		- the function has access to Items.* and context
//		- the constructor can be called from two contexts:
//			- external
//				called from the module or as a function...
//				calls the passed constructor (passing context)
//				builds the container
//			- nested
//				called from constructor function...
//				calls constructor (if applicable)
//				builds item(s)
// XXX need a way to pass container constructors (a-la ui-widgets dialog containers)
// 		- passing through the context (this) makes this more flexible...
// 		- passing via args fixes the signature which is a good thing...
//		
//

// XXX
var Items = module.items = function(){}

// singular items...
// 
// 	.Item(value[, make][, options])
// 		-> ???
// 	
var Items.Item = function(value, make, options){
}

var Items.Editable = function(value){}
var Items.Selected = function(value){}
var Items.Action = function(value){}
var Items.ConfirmAction = function(value){}
var Items.Empty = function(value){}
var Items.Separator = function(value){}
var Items.Spinner = function(value){}
var Items.Heading = function(value){}

// groups...
var Items.Group = function(items){}

// lists...
var Items.List = function(values){}
var Items.EditableList = function(values){}
var Items.EditablePinnedList = function(values){}




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })

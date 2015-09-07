/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}
console.log('>>> widget')

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/
// helpers...

var proxyToDom =
module.proxyToDom = 
function(name){
	return function(){ 
		this.dom[name].apply(this.dom, arguments)
		return this 
	}
}


// XXX triggering events from here and from jQuery/dom has a 
// 		different effect...
var triggerEventWithSource =
module.triggerEventWithSource = 
function(){
	var args = args2array(arguments)
	var evt = args.shift()
	
	if(typeof(evt) == typeof('str')){
		evt = $.Event(evt)
	}

	evt.source = this

	args.splice(0, 0, evt)

	this.dom.trigger.apply(this.dom, args)
	return this 
}



/*********************************************************************/




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })

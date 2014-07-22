/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}
console.log('>>> loader')

var data = require('data')



/*********************************************************************/

module.loadData = function(target, callback){
	// Data...
	if(target instanceof data.Data){
		callback(target)
	
	// Object...
	} else if(typeof(target) == typeof({})){
		callback(data.Data(target))

	// String...
	} else if(typeof(target) == typeof('str')){
		// url...
		if(/^(http:|file:|app:|embed:)/.test(target)){
		} 
	}
}




/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })

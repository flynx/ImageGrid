/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

// XXX need to figure out a way to get the version from package.json and 
// 		do it in:
// 			- bare nodejs 
// 				> node version.js
// 			- browser + requirejs + file://
// 			- browser + requirejs + http*
var VERSION = '4.0.0a'

console.log(VERSION)

module.version = VERSION



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })

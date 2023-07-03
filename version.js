/**********************************************************************
* 
* NOTE: version.js is generated automatically by Makefile from a template
* 	do not edit directly.
* 	Edit version.js.tpl instead.
*
* Build: 202307031035
* Commit: 6aa2abed1a146c5c81c6bf1931d6a67528ad24ef
*
* NOTE: the build/commit data is of the time the version.js was built 
* 	but may not be the current/latest...
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

// The version lives in package.json
//
// We need to be able to read the correct version in the folowing 
// contexts:
// 	- nodejs/electron	- can load JSON directly
// 	- browser (remote)	- can load json via the require('json!package.json')
// 	- browser (local)	- can't get access to .json files
// Thus the only way around this is to generate this file from a template.

module.version = '4.0.8a'



/**********************************************************************
* vim:set ts=4 sw=4 ft=javascript :                 */ return module })

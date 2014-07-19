/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/
//
// Basic terms:
// 	- trigger
// 		this is similar to an event bind...
// 	- filter
// 	- action
// 		fast reaction to instantanious actions, this is the same as an 
// 		event handler...
// 	- feedback
// 		feedback loop used for long interactions
//
// * might be a good idea to combine trigger and filter...
//
//
// DSL loading stages:
// 	Stage 1: Read.
// 		- read the code
// 		- eval the code
// 		- introspection
// 	Stage 2: Run.
// 		- install hooks
// 		- introspection
// 		- run the handlers
//
//
/*********************************************************************/



/*********************************************************************/
// Slang version candidate:
//
// 	on click
// 		if [ ... ]
// 			do [ ... ]
//
// 	if [ ... ]
// 		key X
// 			do [ ... ]
// 		

var context = Context('test')
	// trigger...
	.on('click')
		// filter...
		.when(function(){ return true })
			// action...
			.act(function(){
				return
			})
			// action...
			.done()
	.when(function(){ return true })
		.key('X')
			.act(function(){  })



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */

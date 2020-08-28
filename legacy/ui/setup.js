/**********************************************************************
* 
*
**********************************************************************/

// list of functions to setup different bindings
//
// each function must be of the form:
// 	setupBinding(viewer) -> viewer
//
// NOTE: we are not using an event handler here as the DOM might not yet
// 		be loaded...
// XXX still need to think about this...
var SETUP_BINDINGS = []



/*********************************************************************/

function setupDataBindings(viewer){
	viewer = viewer == null ? $('.viewer') : viewer

	// see SETUP_BINDINGS definition for docs...
	SETUP_BINDINGS.forEach(function(setup){
		setup(viewer)
	})

}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */

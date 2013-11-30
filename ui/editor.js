/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/

// ImageGrid-specific editor setup...
function setupEditor(){
	// build the editor...
	if($('.panel').length == 0){
		$('.viewer')
			.append(makeEditorControls('.current.image')
				.addClass('noScroll'))

			// setup the event to update the editor...
			.on('focusingImage', function(){
				if($('.panel').css('display') != 'none'){
					reloadControls('.current.image')
				}
			})

		reloadControls('.current.image')

	// toggle the editor...
	// XXX do we need a real mode for this?
	} else {
		var ed = $('.panel')

		// show...
		if(ed.css('display') == 'none'){
			reloadControls('.current.image')
			ed.show()

		// hide...
		} else {
			ed.hide()
		}
	}
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */

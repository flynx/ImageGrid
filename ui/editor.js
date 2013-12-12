/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/
// XXX these are a bit too general... 
// 		...the editor needs to speak in terms of the editor only...
// 		right now the editor mode depends on presence of panels and not
// 		the editor itself...

function _setupPanel(panel){
	return panel
		.on('panelClosing', function(){
			if($('.panel').length <= 1){
				// XXX when not only the editor is using the panels, this
				// 		is not the correct way to go...
				toggleEditor('off')
			}
		})
		.on('newPanel', function(evt, panel){
			_setupPanel(panel)
		})
		// make clicks on unfocusable elements remove focus...
		.click(function(){
			if(event.target != $('.panel :focus')[0]){
				$('.panel :focus').blur()
			}
		})
}


var toggleEditor = createCSSClassToggler(
		'.viewer', 
		'.editor-visible',
		function(action){
			// XXX when not only the editor is using the panels, this
			// 		is not the correct way to go...
			var ed = $('.panel')

			if(action == 'on'){
				// create the editor if this is first init...
				if(ed.length == 0){
					$('.viewer')
						.append(_setupPanel(makeEditorControls('.current.image'))
							//.draggable('option', 'snap', '.viewer')
							.css({
								// prevent the editor from moving under 
								// the title bar, that will prevent us from
								// ever moving it away or closing it...
								'margin-top': '20px',
								top: '50px',
								left: '5px',
							}))
							// XXX add handlers for saving data to images...
							// XXX
						// setup the event to update the editor...
						.on('focusingImage', function(){
							if(toggleEditor('?') == 'on'){
								// XXX save previous settings if changes...
								// XXX
								reloadControls('.current.image')
							}
						})
				// show the editor...
				} else {
					ed.show()
				}

				// update the state...
				reloadControls('.current.image')

			// hide...
			} else {
				ed.remove()
			}
		})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */

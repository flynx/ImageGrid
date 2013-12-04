/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/

var toggleEditor = createCSSClassToggler(
		'.viewer', 
		'.editor-visible',
		function(action){
			var ed = $('.panel')

			if(action == 'on'){
				// create the editor if this is first init...
				if(ed.length == 0){
					$('.viewer')
						.append(makeEditorControls('.current.image')
							//.draggable('option', 'snap', '.viewer')
							.addClass('noScroll')
							.css({
								// prevent the editor from moving under 
								// the title bar, that will prevent us from
								// ever moving it away or closing it...
								'margin-top': '20px',
								top: '50px',
								left: '5px',
							})
							// XXX add handlers for saving data to images...
							// XXX
							// make clicks on unfocusable elements remove focus...
							.on('panelClosing', function(){
								toggleEditor('off')
							})
							.click(function(){
								if(event.target != $('.panel :focus')[0]){
									$('.panel :focus').blur()
								}
							}))
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
				ed.hide()
			}
		})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */

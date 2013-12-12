/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true


/*********************************************************************/

function makePanel(title, open, editable_title, keep_empty){
	title = title == null ? '&nbsp;' : title

	// tool panel...
	var panel = $('<details/>')
		.prop('open', open == null ? true : open)
		.addClass('panel noScroll')
		.append($('<summary>'+title+'</summary>')
			.attr({
				contenteditable: editable_title == null ? 'false' : 'true',
			})
			.append($('<span/>')
				.addClass('close-button')
				.click(function(){
					panel
						.trigger('panelClosing')
						.remove()
					return false
				})
				.html('&times;')))
		.draggable({
			containment: 'parent',
			scroll: false,
			// XXX this makes things quite a bit slower...
			stack: '.panel',
			//snap: ".panel", 
			//snapMode: "outer",
		})
		.css({
			// for some reason this is overwritten by jquery-ui to 'relative'...
			//position: '',
			position: 'absolute',
		})


	// wrapper for sub-panels...
	var content = $('<span class="panel-content content">')
		.sortable({
			forcePlaceholderSize: true,
			opacity: 0.7,
			connectWith: '.panel-content',

			start: function(e, ui){
				ui.item.data('isoutside', false)
				ui.placeholder.height(ui.helper.outerHeight());
				ui.placeholder.width(ui.helper.outerWidth());
			},
			// create a new panel when dropping outside of curent panel...
			beforeStop: function(e, ui){
				// do this only when dropping outside the panel...
				if(ui.item.data('isoutside')){
					var new_panel = makePanel()
						// XXX adjust this to scale...
						// XXX adjust this to parent offset...
						.css(ui.offset)
						.appendTo(panel.parent())
					new_panel.find('.panel-content')
							.append(ui.item)
					panel.trigger('newPanel', [new_panel])
				}

				// remove the panel when it runs out of sub-panels...
				if(!keep_empty && panel.find('.sub-panel').length == 0){
					panel
						.trigger('panelClosing')
						.remove()
				}

				ui.item.data('isoutside', false)
			},
			receive: function(e, ui){
				console.log('receive')
				ui.item.data('isoutside', false)
			},
			over: function(e, ui){
				console.log('over')
				ui.item.data('isoutside', false)
			},
			// XXX this is triggered when the sorted object is dropped...
			out: function(e, ui){
				console.log('out')
				ui.item.data('isoutside', true)
			},
		})
		.appendTo(panel)
	return panel
}


function makeSubPanel(title, open, parent){
	title = title == null ? '&nbsp;' : title

	var sub_panel = $('<details/>')
		.addClass('sub-panel noScroll')
		.prop('open', open == null ? true : open)
		.append($('<summary>'+title+'</summary>'))
		.append($('<div class="sub-panel-content content"/>'))

	if(parent != null){
		if(parent.hasClass('panel-content')){
			sub_panel.appendTo(parent)
		} else {
			sub_panel.appendTo(parent.find('.panel-content'))
		}
	}

	return sub_panel
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */

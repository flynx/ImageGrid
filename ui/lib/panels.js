/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

// this is an element/selector to be used as the temporary parent for 
// helpers while dragging/sorting sub-panels...
// if set to null, the parent of a nearest panel will be used (slower)
var PANEL_ROOT = 'body'

var PANEL_HELPER_HIDE_DELAY = 50
var PANEL_HELPER_HIDE_DELAY_NO_ROOT = 100


/**********************************************************************
* Helpers...
*/

// - start monitoring where we are dragged to...
// - open hidden side panels...
function _startSortHandler(e, ui){
	ui.item.data('isoutside', false)
	ui.placeholder
		.height(ui.helper.outerHeight())
		.width(ui.helper.outerWidth())
	// show all hidden panels...
	$('.side-panel').each(function(){
		var p = $(this)
		if(p.find('.sub-panel').length == 0){
			p.css('min-width', '50px')
		}
		if(p.attr('autohide') == 'on'){
			p.attr('autohide', 'off')
			p.data('autohide', true)
		} else {
			p.data('autohide', false)
		}
	})
}


// reset the auto-hide of the side panels...
function _resetSidePanels(){
	$('.side-panel').each(function(){
		var p = $(this)
		p.css('min-width', '')
		if(p.data('autohide')){
			p.attr('autohide', 'on')
		}
	})
}


function _prepareHelper(evt, elem){
	var offset = elem.offset()
	var w = elem.width()
	var h = elem.height()
	var root = elem.parents('.panel, .side-panel').first().parent()
	elem
		.detach()
		.css({
			position: 'absolute',
			width: w,
			height: h,
		})
		.offset(offset)
		.appendTo(root)
	return elem
}


function _resetSortedElem(elem){
	return elem
		.css({
			position: '',
			width: '',
			height: '',
			top: '',
			left: ''
		})
}


// wrap a sub-panel with a new panel...
// 
function wrapWithPanel(panel, parent, offset){
	var new_panel = makePanel()
		.css(offset)
		.appendTo(parent)
	new_panel.find('.panel-content')
			.append(panel)
	return new_panel
}


// close the panel and fire close events on it and all sub-panels...
//
function closePanel(panel){
	panel.find('.sub-panel')
		.trigger('panelClosing')
	panel
		.trigger('panelClosing')
		.remove()
}



/*********************************************************************/

// XXX dragging out, into another panel and back out behaves oddly:
// 		should:
// 			either revert or create a new panel
// 		does:
// 			drops to last placeholder
function makePanel(title, parent, open, keep_empty, close_button){
	title = title == null || title.trim() == '' ? '&nbsp;' : title
	close_button = close_button == null ? true : false
	parent = parent == null ? $(PANEL_ROOT) : parent

	// the outer panel...
	var panel = $('<details/>')
		.prop('open', open == null ? true : open)
		.addClass('panel noScroll')
		.append(close_button
			? $('<summary>'+title+'</summary>')
				.append($('<span/>')
					.addClass('close-button')
					.click(function(){
						closePanel(panel)
						return false
					})
					.html('&times;'))
			: $('<summary>'+title+'</summary>'))
		.draggable({
			containment: 'parent',
			scroll: false,
			stack: '.panel',
			// sanp to panels...
			//snap: ".panel", 
			//snapMode: "outer",
		})
		.css({
			// NOTE: for some reason this is overwritten by jquery-ui to 
			//		'relative' if it's not set explicitly...
			position: 'absolute',
		})

	// content -- wrapper for sub-panels...
	var content = $('<span class="panel-content content">')
		.sortable({
			// general settings...
			forcePlaceholderSize: true,
			forceHelperSize: true,
			opacity: 0.7,
			connectWith: '.panel-content',

			helper: _prepareHelper,
			start: _startSortHandler,

			// - create a new panel when dropping outside of curent panel...
			// - remove empty panels...
			beforeStop: function(e, ui){
				var c = 0

				// do this only when dropping outside the panel...
				//if(ui.placeholder.css('display') == 'none'
				if(ui.item.data('isoutside')
						// prevent draggingout the last panel...
						// NOTE: 2 because we are taking into account 
						// 		the placeholders...
						&& panel.find('.sub-panel').length > 2){
					// compensate for removed item which is still in the
					// panel when we count it...
					// ...this is likely to the fact that we jquery-ui did
					// not cleanup yet
					c = 1
					wrapWithPanel(ui.item, panel.parent(), ui.offset)
				}

				// remove the panel when it runs out of sub-panels...
				if(!keep_empty && panel.find('.sub-panel').length-c <= 0){
					// XXX need to trigger sub-panel's 'closing' event...
					closePanel(panel, true)
				}
				_resetSidePanels()
				_resetSortedElem(ui.item)
					.data('isoutside', false)
			},

			over: function(e, ui){
				ui.item.data('isoutside', false)
				ui.placeholder
					//.height(ui.helper.outerHeight())
					// NOTE: for some reason width does not allways get
					// 		set by jquery-ui...
					.width(ui.helper.outerWidth())
					.show()
			},
			out: function(e, ui){
				ui.item.data('isoutside', true)
				ui.placeholder.hide()
			},
		})
		.appendTo(panel)

	if(parent != false){
		panel.appendTo(parent)
	}

	return panel
}


// side can be:
// 	- left
// 	- right
// XXX in part this is exactly the same as makePanel
function makeSidePanel(side, parent, autohide){
	autohide = autohide == null ? 'on' : 'off'
	parent = parent == null ? $(PANEL_ROOT) : parent
	var panel = $('.side-panel.'+side)
	// only one panel from each side can exist...
	if(panel.length != 0){
		return panel
	}
	panel = $('<div/>')
		.addClass('side-panel panel-content ' + side)
		.attr('autohide', autohide)
		// toggle auto-hide...
		.dblclick(function(e){
			var elem = $(this)
			if(elem.attr('autohide') == 'off'){
				elem.attr('autohide', 'on')
			} else {
				elem.attr('autohide', 'off')
			}
			return false
		})
		.sortable({
			forcePlaceholderSize: true,
			opacity: 0.7,
			connectWith: '.panel-content',

			helper: _prepareHelper,
			start: _startSortHandler,

			// - create a new panel when dropping outside of curent panel...
			// - remove empty panels...
			beforeStop: function(e, ui){
				// do this only when dropping outside the panel...
				if(ui.item.data('isoutside')){
					wrapWithPanel(ui.item, panel.parent(), ui.offset)
				}
				_resetSidePanels()
				_resetSortedElem(ui.item)
					.data('isoutside', false)
			},

			over: function(e, ui){
				ui.item.data('isoutside', false)
				ui.placeholder
					//.height(ui.helper.outerHeight())
					// NOTE: for some reason width does not allways get
					// 		set by jquery-ui...
					.width(ui.helper.outerWidth())
					.show()
			},
			out: function(e, ui){
				ui.item.data('isoutside', true)
				ui.placeholder.hide()
			},
		})

	if(parent != false){
		panel.appendTo(parent)
	}

	return panel
}


// NOTE: if parent is not given this will create a new panel...
// NOTE: title must be unique...
function makeSubPanel(title, content, parent, open, content_resizable){
	title = title == null || title.trim() == '' ? '&nbsp;' : title
	parent = parent == null ? makePanel() : parent

	open = open == null ? true : open
	content_resizable = content_resizable == null 
		? false 
		: content_resizable

	var content_elem = $('<div class="sub-panel-content content"/>')
		.attr('id', title)
	if(content != null){
		content_elem
			.append(content)
	}
	var sub_panel = $('<details/>')
		.addClass('sub-panel noScroll')
		.prop('open', open)
		.append($('<summary>'+title+'</summary>'))
		.append(content_elem)

	if(parent != null){
		if(parent.hasClass('panel-content')){
			sub_panel.appendTo(parent)
		} else {
			sub_panel.appendTo(parent.find('.panel-content'))
		}
	}

	if(content_resizable){
		// NOTE: we are wrapping the content into a div so as to make 
		// 		the fact that the panel is resizable completely 
		// 		transparent for the user -- no need to be aware of the 
		// 		sizing elements, etc.
		content_elem.wrap($('<div>')).parent()
			.resizable({
				handles: 's',
			})
			.css({
				overflow: 'hidden',
			})
	}

	return sub_panel
}



/**********************************************************************
* High level interface...
*/

var PANELS = {
}


// NOTE: this will search an element by title, so if it is not unique 
// 		an existing element will be returned...
function buildPanelController(title, content_builder, setup){

	var controller = function(parent){
		// 1) search for panel and return it if it exists...
		var panel = $('[id="'+ title +'"]')

		// 2) if no panel exists, create it
		// 		- content_builder() must return panel content
		if(panel.length == 0){
			parent = parent == null ? $(PANEL_ROOT) : parent

			panel = makeSubPanel(title, content_builder, false)
				.attr('id', title)
			setup(panel)

			panel.appendTo(parent)
		}

		return panel
	}

	PANELS[title] = controller

	return controller
}



/*********************************************************************/

function getPanelState(){
	var res = []

	var _getPanel = function(){
		var panel = $(this)
		var offset = panel.offset()
		var sub_panels = panel.find('.sub-panel')

		res.push({
			type: (panel.hasClass('panel') ? 'panel'
					: panel.hasClass('side-panel') 
						&& panel.hasClass('left') ? 'side-panel-left'
					: panel.hasClass('side-panel') 
						&& panel.hasClass('right') ? 'side-panel-right'
					: null),

			top: offset.top,
			left: offset.left,

			open: panel.prop('open') ? true : false,
			autohide: panel.attr('autohide'),

			content: sub_panels.map(function(){
				var p = $(this)
				return {
					title: p.find('summary').text(),
				}
			}).toArray(),
		})
	}

	$('.panel, .side-panel').each(_getPanel)

	return res
}


function setPanelState(data){
	// XXX
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */

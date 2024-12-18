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


// Panel controller registry...
//
// Format:
// 	{
// 		<title>: <controller>,
// 		...
// 	}
//
// The controller is generated by Panel(...) and is called
// automatically by openPanel(...)
var PANELS = {}


// XXX write real doc...
// XXX see getPanelState(...)
// XXX we should keep track of panel state while moving, opening, closing
// 		and resizing panels...
// XXX move this to config???
var PANEL_STATE = {}


/*
// This can be:
// 	- hide
// 	- remove
var PANEL_CLOSE_METHOD = 'hide'
*/



/**********************************************************************
* Helpers...
*/

// - start monitoring where we are dragged to...
// - open hidden side panels...
// XXX store number of panels we started with...
function _startSortHandler(e, ui){
	ui.item.data('isoutside', false)
	ui.item.data('sub-panels-before', $(this).find('.sub-panel').length)
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


// XXX add visibility test here...
function isPanelVisible(panel){
	return panel.prop('open')
			&& (panel.parents('.panel').prop('open')
				|| panel.parents('.side-panel').width() > 20)
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


function getPanel(title){
	return $('[id="'+ title +'"]')
}


function blinkPanel(panel){
	panel
		.addClass('blink')
	setTimeout(function(){
		panel.removeClass('blink')
	}, 170)
	return panel
}



/**********************************************************************
* Constructors...
*/

// XXX dragging out, into another panel and back out behaves oddly:
// 		should:
// 			either revert or create a new panel
// 		does:
// 			drops to last placeholder
// XXX need to stop this triggering panelClosing event when the last 
// 		panel is dragged out or when the panel is dragged...
function makePanel(title, parent, open, keep_empty, close_button){
	title = title == null || title.trim() == '' ? '&nbsp;' : title
	parent = parent == null ? $(PANEL_ROOT) : parent
	close_button = close_button == null ? true : close_button

	// the outer panel...
	var panel = $('<details/>')
		.prop('open', open == null ? true : open)
		.addClass('panel noScroll')
		// NOTE: this is split into a separate event so as to be able to
		// 		be accessed from different contexts...
		.on('subPanelsUpdated', function(){
			// remove the panel when it runs out of sub-panels...
			if(!keep_empty && panel.find('.sub-panel:visible').length <= 0){
				removePanel(panel, true)
			}
		})
		.append((close_button
			? $('<summary>'+title+'</summary>')
				.append($('<span/>')
					.addClass('close-button')
					.click(function(){
						removePanel(panel)
						return false
					})
					.html('&times;'))
			: $('<summary>'+title+'</summary>'))
				// XXX also do this on enter...
				// XXX
				.click(function(){
					if(!panel.prop('open')){
						var evt = 'panelOpening'
					} else {
						var evt = 'panelClosing'
					}
					panel.trigger(evt, panel)
					panel.find('.sub-panel').each(function(){
						var sub_panel = $(this)
						if(sub_panel.prop('open')){
							sub_panel.trigger(evt, sub_panel)
						}
					})
				}))
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
				// do this only when dropping outside the panel...
				if(ui.item.data('isoutside')
						// prevent draggingout the last panel...
						// NOTE: 2 because we are taking into account 
						// 		the placeholders...
						&& panel.find('.sub-panel').length > 2){
					wrapWithPanel(ui.item, panel.parent(), ui.offset)
				}

				panel.trigger('subPanelsUpdated')

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

	// NOTE: no need to call the panelOpening event here as at this point
	// 		no one had the chance to bind a handler...

	return panel
}


// side can be:
// 	- left
// 	- right
//
// XXX in part this is exactly the same as makePanel
// XXX need to trigger open/close sub panel events...
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
		// XXX trigger open/close events on hide/show..
		// XXX
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
		// hide temporarily opened side-panels...
		.mouseout(function(){
			// XXX jQuery bug: this does not work...
			//panel.prop('open', false)
			panel.attr('open', null)
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

	// NOTE: no need to call the panelOpening event here as at this point
	// 		no one had the chance to bind a handler...

	return panel
}


// NOTE: if parent is not given this will create a new panel...
// NOTE: title must be unique...
function makeSubPanel(title, content, parent, open, content_resizable, close_button){
	title = title == null || title.trim() == '' ? '&nbsp;' : title
	parent = parent == null ? makePanel() : parent
	close_button = close_button == null ? true : close_button

	open = open == null ? true : open
	content_resizable = content_resizable == null 
		? false 
		: content_resizable

	var content_elem = $('<div class="sub-panel-content content"/>')
	if(content != null){
		content_elem
			.append(content)
	}
	var sub_panel = $('<details/>')
		.attr('id', title)
		.addClass('sub-panel noScroll')
		.prop('open', open)
		.append((close_button
			? $('<summary>'+title+'</summary>')
				.append($('<span/>')
					.addClass('close-button')
					.click(function(){
						var parent = sub_panel.parents('.panel').first()
						removePanel(sub_panel)
						// notify the parent context update...
						parent.trigger('subPanelsUpdated')
						return false
					})
					.html('&times;'))
			: $('<summary>'+title+'</summary>'))
			// XXX also do this on enter...
			// XXX
			.click(function(){
				if(!sub_panel.prop('open')){
					sub_panel.trigger('panelOpening', sub_panel)
				} else {
					sub_panel.trigger('panelClosing', sub_panel)
				}
			}))
		.append(content_elem)

	if(parent != null && parent != false){
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

	// NOTE: no need to call the panelOpening event here as at this point
	// 		no one had the chance to bind a handler...

	return sub_panel
}



/**********************************************************************
* Actions...
*/

// XXX this should take the state into consideration while opening panels
// 		and open panels in specific parents and locations, maybe even with
// 		other neighbor panels...
// XXX currently parent is ignored if panel is already created, is this 
// 		correct???
// XXX update panel state...
function openPanel(panel, parent, no_blink){
	var title = typeof(panel) == typeof('str') ? panel : null
	panel = typeof(panel) == typeof('str')
		? getPanel(panel)
		: panel
	title = title == null ? panel.attr('id') : title
	var open = false
	
	// create a new panel...
	if(panel.length == 0){
		if(title in PANELS){
			var builder = PANELS[title]
			panel = builder({ 
				open: true,
				parent: parent,
			})
		}

	// show/open the panel and all it's parents...
	} else {
		open = isPanelVisible(panel)
		// show panels...
		panel
			.css('display', '')
			.prop('open', true)
			.parents('.panel')
				.css('display', '')
				.prop('open', true)
		// show side panels...
		panel
			.parents('.side-panel').first()
				// XXX jQuery bug: this does not work...
				//.prop('open', true)
				.attr('open', 'yes')
	}

	// if the panel was not open trigger the event...
	if(!open){
		panel.trigger('panelOpening', panel)
	}

	return no_blink ? panel : blinkPanel(panel)
}


// Open a set of sub-panels in one parent panel...
//
// returns the parent panel.
//
// NOTE: if parent is given and already exists then this will append the
// 		new panels to it...
// NOTE: this will not re-group already opened panels...
function openGroupedPanels(panels, parent){
	panels = typeof(panels) == typeof('str') ? [panels] : panels
	parent = parent == null ? makePanel() : parent

	panels.forEach(function(title){
		openPanel(title, parent, true)
	})

	return parent
}


// XXX
// XXX update panel state...
function openPanels(){
	// XXX
}


// Close the panel...
//
// NOTE: this does not care if it's a panel or sub-panel...
// XXX do we need a panelRemoved event???
// 		...and a symmetrical panelCreated??
// XXX update panel state...
function closePanel(panel){
	panel = typeof(panel) == typeof('str')
		? getPanel(panel)
		: panel
	panel.find('.sub-panel:visible').each(function(){
		var p = $(this)
		if(p.prop('open')){
			p.trigger('panelClosing', p)
		}
	})
	return panel
		.prop('open', false)
		.trigger('panelClosing', panel)
}


// Remove the panel after firing close events on it and all sub-panels...
//
// XXX update panel state...
function removePanel(panel){
	panel = typeof(panel) == typeof('str')
		? getPanel(panel)
		: panel
	/*
	if(PANEL_CLOSE_METHOD == 'hide'){
		return closePanel(panel)
			.hide()
	} else {
		return closePanel(panel)
			.remove()
	}
	*/
	return closePanel(panel)
		.hide()
}



/**********************************************************************
* High level interface...
*/

//
//	content_builder()	- should build and setup panel content
//	panel_setup(panel)	- should register panel open/close event 
//							handlers
//
// NOTE: this will search an element by title, so if it is not unique 
// 		an existing element will be returned...
function Panel(title, content_builder, panel_setup, content_resizable){

	var controller = function(state){
		state = state == null ? {} : state
		var parent = state.parent
		var open = state.open

		// 1) search for panel and return it if it exists...
		var panel = getPanel(title)

		// 2) if no panel exists, create it
		// 		- content_builder() must return panel content
		if(panel.length == 0){
			panel = makeSubPanel(title, content_builder(), parent, open, content_resizable)
				.attr('id', title)

			panel_setup(panel)

			// trigger the open event...
			if(isPanelVisible(panel)){
				panel.trigger('panelOpening', panel)
			}

		} else {
			var v = isPanelVisible(panel)

			if(open && !v){
				openPanel(panel)

			} else if(!open && v){
				closePanel(panel)
			}
		}

		// XXX set panel position, size, ...

		return panel
	}

	PANELS[title] = controller

	return controller
}


// XXX also need:
// 		- togglePanels()
// 			show/hide all the panels (a-la Photoshop's Tab action)



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

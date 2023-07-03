/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/




/*********************************************************************/

var selectElemText =
module.selectElemText = 
function(elem){
	var range = document.createRange()
	range.selectNodeContents(elem)
	var sel = window.getSelection()
	sel.removeAllRanges()
	sel.addRange(range) }


// XXX make this global...
var getCaretOffset = 
module.getCaretOffset =
function(elem){
	var s = window.getSelection()
	if(s.rangeCount == 0){
		return -1 }
	var r = s.getRangeAt(0)
	var pre = r.cloneRange()
	pre.selectNodeContents(elem)
	pre.setEnd(r.endContainer, r.endOffset)
	return pre.toString().length || 0 }


var selectionCollapsed =
module.selectionCollapsed =
function(elem){
		var s = window.getSelection()
		if(s.rangeCount == 0){
			return false }
		return s.getRangeAt(0).cloneRange().collapsed }



//---------------------------------------------------------------------
// XXX experiment
if(typeof(jQuery) != typeof(undefined)){
	jQuery.fn._drag = function(){
		var dragging = false
		var s, 
			px, py

		var elem = $(this)
			.on('mousedown touchstart', function(evt){
				dragging = true
				px = evt.clientX
				px = evt.clientY

				s = elem.rscale() })
			.on('mousemove touchmove', function(evt){
				if(!dragging){
					return }

				var x = evt.clientX 
				var dx = px - x
				px = x

				var y = evt.clientY 
				var dy = py - y
				py = y

				elem
					.velocity('stop')
					.velocity({
						translateX: '-=' + (dx / s),
						translateY: '-=' + (dy / s),
					}, 0) })
			.on('mouseup touchend', function(evt){
				dragging = false
				elem.velocity('stop') }) }


	jQuery.fn.selectText = function(mode){
		var range = document.createRange()

		this.each(function(){
			range.selectNodeContents(this) })

		var sel = window.getSelection()
		sel.removeAllRanges()

		mode === null
			|| sel.addRange(range)

		return this }
	jQuery.fn.deselectText = 
		function(){ 
			this.selectText(null) 
			return this }
	jQuery.fn.caretOffset = 
		function(){ 
			return getCaretOffset(this) }
	jQuery.fn.selectionCollapsed = 
		function(){ 
			return selectionCollapsed(this) }


	var keyboard = require('lib/keyboard')

	// Make element editable...
	//
	// Options format:
	// 	{
	// 		// activate (focus) element...
	// 		//
	// 		// NOTE: this will also select the element text...
	// 		activate: false,
	//
	// 		// set multi-line edit mode...
	// 		multiline: false,
	//
	// 		// if true in multi-line mode, accept filed on Enter, while
	// 		// ctrl-Enter / meta-Enter insert a new line; otherwise
	// 		// ctrl-Enter / meta-Enter will accept the edit.
	// 		accept_on_enter: true,
	//
	// 		// clear element value on edit...
	// 		clear_on_edit: false,
	//
	// 		// reset value on commit/abort...
	// 		// XXX revise default...
	// 		reset_on_commit: true,
	// 		reset_on_abort: true,
	//
	// 		// blur element on commit/abort...
	// 		blur_on_commit: false,
	// 		blur_on_abort: false,
	//
	// 		// restore focus before disabling the editor...
	// 		keep_focus_on_parent: true,
	//
	// 		// clear selection on commit/abort...
	// 		clear_selection_on_commit: true,
	// 		clear_selection_on_abort: true,
	//
	// 		// If false unhandled key events will not be propagated to 
	// 		// parents...
	// 		propagate_unhandled_keys: true,
	//
	// 		// If false the element editable state will not be reset to
	// 		// the original when edit is done...
	// 		reset_on_done: true,
	//
	// 		// Keys that will abort the edit...
	// 		abort_keys: [
	// 			'Esc',
	// 		],
	// 	}
	//
	// This listens to these events triggerable by user:
	// 	'edit-commit'		- will commit changes, this is passed the 
	// 							new text just edited.
	// 	'edit-abort'		- will reset field, this is passed the 
	// 							original text before the edit.
	//
	// These events get passed the relevant text, but the element is 
	// likely to be already reset to a different state, to get the 
	// element before any state change is started use one of the 
	// following variants:
	// 	'edit-committing'	- triggered within 'edit-commit' but before
	// 							anything is changed, gets passed the final
	// 							text (same as 'edit-commit')
	// 	'edit-aborting'		- triggered within 'edit-abort' but before 
	// 							anything is changed, gets passed the 
	// 							original text value (same as 'edit-abort')
	//
	// This will try and preserve element content DOM when resetting.
	//
	//
	// NOTE: removing tabindex will reset focus, so this will attempt to 
	// 		focus the first [tabindex] element up the tree...
	//
	// XXX add option to select the element on start or just focus it...
	// 		.activate: 'select' | true | false
	// XXX should we just use form elements???
	// 		...it's a trade-off, here we add editing functionality and fight
	// 		a bit the original function, in an input we'll need to fight part
	// 		of the editing functionality and add our own navigation...
	// XXX move this to a more generic spot...
	jQuery.fn.makeEditable = function(options){
		var that = this

		if(options == false){
			this
				.removeAttr('contenteditable')
				.removeAttr('tabindex')
				.removeClass('editable-field')

			var events = this.data('editable-field-events')
			for(var e in events){
				this.off(e, events[e]) }
			this.removeData('editable-field-events')

			return this }

		options = Object.assign({
			// defaults...
			activate: false,
			multiline: false,
			accept_on_enter: true,
			clear_on_edit: false,
			reset_on_commit: true,
			reset_on_abort: true,
			blur_on_commit: false,
			blur_on_abort: false,
			keep_focus_on_parent: true,
			clear_selection_on_commit: true,
			clear_selection_on_abort: true,
			propagate_unhandled_keys: true,
			reset_on_done: true,
			abort_keys: ['Esc'],
		}, options || {})

		var original_text = this[0].innerText
		var original_dom = document.createDocumentFragment()
		this[0].childNodes
			.forEach(function(node){ 
				original_dom.appendChild(node.cloneNode(true)) })
		var resetOriginal = function(){
			//that.text(original_text)
			that[0].innerHTML = ''
			that[0].appendChild(original_dom.cloneNode(true)) }

		this.prop('contenteditable', true)

		options.activate 
			&& options.clear_on_edit 
			// XXX this for some reason breaks on click...
			&& this.text('')

		// NOTE: this will also focus the element...
		options.activate 
			&& this.selectText()

		// do not setup handlers more than once...
		if(!this.hasClass('editable-field')){
			var events = {}
			this
				// make the element focusable and selectable...
				.attr('tabindex', '0')
				.addClass('editable-field')
				.keydown(events.keydown = function(in_evt){ 
					var evt = window.event || in_evt
					if(!that.prop('contenteditable')){
						return }

					evt.stopPropagation() 

					var c = getCaretOffset(this)
					var collapsed = selectionCollapsed(this) 
					var n = keyboard.code2key(evt.keyCode)

					// abort...
					if((options.abort_keys || []).indexOf(n) >= 0){
						that.trigger('edit-abort', original_text)

					// done -- single line...
					} else if(n == 'Enter' 
							&& !options.multiline){
						evt.preventDefault()
						that.trigger('edit-commit', 
							that.length == 1 ? 
								that[0].innerText 
								: that.toArray().map(function(e){ return e.innerText }))

					// done -- multi-line...
					} else if(options.multiline 
							&& n == 'Enter' 
							&& (options.accept_on_enter ?
								!(evt.ctrlKey || evt.shiftKey || evt.metaKey) 
								: (evt.ctrlKey || evt.shiftKey || evt.metaKey)) ){
						evt.preventDefault()
						that.trigger('edit-commit', 
							that.length == 1 ? 
								that[0].innerText 
								: that.toArray().map(function(e){ return e.innerText }))

					// multi-line keep keys...
					} else if(options.multiline 
							&& options.accept_on_enter ? 
								(n == 'Enter' 
								 	&& (evt.ctrlKey || evt.shiftKey || evt.metaKey))
								: n == 'Enter'){
						return

					// multi-line arrow keys -- keep key iff not at first/last position...
					} else if(options.multiline
							&& n == 'Up'
							&& (c > 0 || !collapsed)){
						return
					} else if(options.multiline
							&& n == 'Down'
							&& (c < $(this).text().length || !collapsed)){
						return
					} else if(n == 'Up' || n == 'Down'){
						evt.preventDefault()
						that.trigger('edit-commit', 
							that.length == 1 ? 
								that[0].innerText 
								: that.toArray().map(function(e){ return e.innerText }))

					// continue handling...
					} else if(options.propagate_unhandled_keys){
						// NOTE: jQuery can't reuse browser events, this 
						// 		we need to pass a jq event/proxy here...
						$(this).parent().trigger(in_evt || evt) }
				})
				.blur(events.blur = function(){
					window.getSelection().removeAllRanges() })
				.on('focus click', events['focus click'] = function(evt){
					evt.stopPropagation()
					options.clear_on_edit 
						&& $(this)
							.text('')
							.selectText() })
				// user triggerable events...
				.on('edit-abort', events['edit-abort'] = function(evt, text){
					that.trigger('edit-aborting', text)

					options.clear_selection_on_abort
						&& window.getSelection().removeAllRanges()

					// reset original value...
					options.reset_on_abort
						&& resetOriginal() 
					options.blur_on_abort
						&& this.blur() 

					// restore focus on parent...
					options.keep_focus_on_parent
						&& that.parents('[tabindex]').first().focus()

					options.reset_on_done
						&& that.makeEditable(false) })
				.on('edit-commit', events['edit-commit'] = function(evt, text){
					that.trigger('edit-committing', text)

					options.clear_selection_on_commit
						&& window.getSelection().removeAllRanges()

					// reset original value...
					options.reset_on_commit
						&& resetOriginal() 
					options.blur_on_commit
						&& this.blur() 

					// restore focus on parent...
					options.keep_focus_on_parent
						&& that.parents('[tabindex]').first().focus()

					options.reset_on_done
						&& that.makeEditable(false) })

			this.data('editable-field-events', events) }

		return this }



}



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })

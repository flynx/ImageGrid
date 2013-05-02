/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true



/*********************************************************************/

// Neither _SPECIAL_KEYS nor _KEY_CODES are meant for direct access, use
// toKeyName(<code>) and toKeyCode(<name>) for a more uniform access.
//
// NOTE: these are un-shifted ASCII key names rather than actual key 
// 		code translations.
// NOTE: ASCII letters (capital) are not present because they actually 
// 		match their key codes and are accessible via:
// 			String.fromCharCode(<code>) or <letter>.charCodeAt(0)
// NOTE: the lower case letters are accessible by adding 32 to the 
// 		capital key code.
// NOTE: don't understand why am I the one who has to write this...
var _SPECIAL_KEYS = {
	// Special Keys...
	9:		'Tab',		33:		'PgUp',		45:		'Ins',		
	13:		'Enter',	34:		'PgDown',	46:		'Del',		
	16:		'Shift',	35:		'End',		80:		'Backspace',
	17:		'Ctrl',		36:		'Home',		91:		'Win',		
	18:		'Alt',		37:		'Left',		93:		'Menu',		
	20:		'Caps Lock',38:		'Up',	 
	27:		'Esc',		39:		'Right',  
	32:		'Space',	40:		'Down',  

	// Function Keys...
	112:	'F1',		116:	'F5',		120:	'F9', 
	113:	'F2',		117:	'F6',		121:	'F10',
	114:	'F3',		118:	'F7',		122:	'F11',
	115:	'F4',		119:	'F8',		123:	'F12',

	// Number row..
	49: '1',	50: '2',	51: '3',	52: '4',	53: '5',
	54: '6', 	55: '7',	56: '8',	57: '9',	48: '0',

	// Punctuation...
	// top row...
	192: '`',		/* Numbers */		189: '-',	187: '=',
	// right side of keyboard...
				219: '[',	221: ']',	220: '\\',
				186: ';',	222: '\'',
	188: ',',	190: '.',	191: '/',
}

var _KEY_CODES = {}
for(var k in _SPECIAL_KEYS){
	_KEY_CODES[_SPECIAL_KEYS[k]] = k
}


// XXX some keys look really wrong...
function toKeyName(code){
	// check for special keys...
	var k = _SPECIAL_KEYS[code]
	if(k != null){
		return k
	}
	// chars...
	k = String.fromCharCode(code)
	if(k != ''){
		//return k.toLowerCase()
		return k
	}
	return null
}

function toKeyCode(c){
	if(c in _KEY_CODES){
		return _KEY_CODES[c]
	}
	return c.charCodeAt(0)
}


// if set to false the event handlers will always return false...
var KEYBOARD_HANDLER_PROPAGATE = true

/* Basic key binding format:
 *
 * {
 * 		<css-selector>: {
 *			// meta-data used to generate user docs/help/config
 * 			title: <text>,
 * 			doc: <text>,
 *
 *			// this defines the list of keys to ignore by the handler.
 *			// NOTE: use "*" to ignore all keys other than explicitly 
 *			// 		defined in the current section.
 * 			ignore: <ignored-keys>
 *
 * 			<key-def> : <callback>,
 *
 * 			<key-def> : {
 *				// modifiers can either have a callback or an alias as 
 *				// a value...
 *				// NOTE: when the alias is resolved, the same modifiers 
 *				//		will be applied to the final resolved handler.
 * 				'default': <callback> | <key-def-x>,
 *
 *				// a modifier can be any single modifier, like shift or a 
 *				// combination of modifers like 'ctrl+shift', given in order 
 *				// of priority.
 *				// supported modifiers are (in order of priority):
 *				//	- ctrl
 *				//	- alt
 *				//	- shift
 * 				<modifer>: [...],
 * 				...
 * 			},
 *
 * 			<key-def> : [
 *				// this can be any type of handler except for an alias...
 * 				<handler>, 
 * 				<doc>
 * 			],
 *
 *			// alias...
 * 			<key-def-a> : <key-def-b>,
 *
 *			...
 * 		},
 *
 * 		...
 * }
 *
 *
 * <key-def> can be:
 * 	- explicit key code, e.g. 65
 * 	- key name, if present in _SPECIAL_KEYS, e.g. Enter
 * 	- key char (uppercase), as is returned by String.fromCharCode(...) e.g. A
 *
 *
 * NOTE: to rest what to use as <key-def> use toKeyCode(..) / toKeyName(..).
 * NOTE: all fields are optional.
 * NOTE: if a handler explicitly returns false then that will break the 
 * 		event propagation chain and exit the handler.
 * 		i.e. no other matching handlers will be called.
 * NOTE: a <css-selector> is used as a predicate to select a section to 
 * 		use. if multiple selectors match something then multiple sections 
 * 		will be resolved in order of occurrence.
 *
 * XXX might need to add meta information to generate sensible help...
 */
function makeKeyboardHandler(keybindings, unhandled){
	if(unhandled == null){
		//unhandled = function(){return false}
		unhandled = function(){return KEYBOARD_HANDLER_PROPAGATE}
	}
	return function(evt){
		var did_handling = false
		var res = null
		for(var mode in keybindings){
			if($(mode).length > 0){
				var bindings = keybindings[mode]

				var key = evt.keyCode
				var chr = toKeyName(evt.keyCode)
				// normalize the modifiers...
				var modifers = evt.ctrlKey ? 'ctrl' : ''
				modifers += evt.altKey ? (modifers != '' ? '+alt' : 'alt') : ''
				modifers += evt.shiftKey ? (modifers != '' ? '+shift' : 'shift') : ''

				if(chr in bindings){
					var handler = bindings[chr]
				} else {
					var handler = bindings[key]
				}

				// alias...
				while (typeof(handler) == typeof(123) 
						|| typeof(handler) == typeof('str')
						|| typeof(handler) == typeof({}) && handler.constructor.name == 'Object') {

					// do the complex handler aliases...
					if(typeof(handler) == typeof({}) && handler.constructor.name == 'Object'){
						if(typeof(handler[modifers]) == typeof('str')){
							handler = handler[modifers]
						} else if(typeof(handler['default']) == typeof('str')){
							handler = handler['default']
						} else {
							break
						}
					}

					// simple handlers...
					if(handler in bindings){
						// XXX need to take care of that we can always be a number or a string...
						handler = bindings[handler]
					} else if(typeof(handler) == typeof(1)) {
						handler = bindings[toKeyName(handler)]
					} else {
						handler = bindings[toKeyCode(handler)]
					}
				}
				// no handler...
				if(handler == null){
					// if something is ignored then just breakout and stop handling...
					if(bindings.ignore == '*' 
							|| bindings.ignore != null && bindings.ignore.indexOf(key) != -1){
						res = res == null ? true : res
						did_handling = true
						// ignoring a key will stop processing it...
						break
					}
					continue
				}
				// Array, lisp style with docs...
				// XXX for some odd reason typeof([]) == typeof({})!!!
				if(typeof(handler) == typeof([]) && handler.constructor.name == 'Array'){
					// we do not care about docs here, so just get the handler...
					handler = handler[0]
				}
				// complex handler...
				if(typeof(handler) == typeof({}) && handler.constructor.name == 'Object'){
					var callback = handler[modifers]
					if(callback == null){
						callback = handler['default']
					}
					if(callback != null){
						res = callback()
						did_handling = true
						continue
					}
				} else {
					// simple callback...
					//res = handler(evt) 
					res = handler() 
					// if the handler explicitly returned false break out...
					if(res === false){
						// XXX is this corrent???
						// XXX should we just break here instead of return...
						return KEYBOARD_HANDLER_PROPAGATE ? res : null
					}
					did_handling = true
					continue
				}
			}
		}
		if(!did_handling){
			// key is unhandled by any modes...
			return unhandled(key)
		} else {
			// XXX should we handle multiple hits???
			return KEYBOARD_HANDLER_PROPAGATE&&res?true:false
		}
	}
}


// helper...
function doc(text, func){
	func.doc = text
	return func
}

/* Build structure ready for conversion to HTML help.
* Structure:
* 	{
* 		<section-title>: {
* 			doc: ...
*
* 			<handler-doc>: <keys-spec>
* 			...
* 		}
* 	}
*
* 	<keys-spec> 	- list of key names.
*
*/
function getKeyHandler(key, keybindings){
}



function buildKeyindingsHelp(keybindings){
	var res = {}

	for(var selector in keybindings){
		var section = keybindings[selector]
		var title = section.title == null ? selector : section.title
		var res_sec = {
			doc: section.doc,
		}
		res.title = res_sec

		for(var k in section){
			// handler...
			var h = section[k]
			var doc
			var key = typeof(k) == typeof(1) ? toKeyName(k) : k

			// an alias...
			while(typeof(h) == typeof(1) || typeof(h) == typeof('s')){
				if(h in section){
					// XXX need to take care of that we can always be a number or a string...
					h = section[h]
				} else if(typeof(h) == typeof(1)) {
					h = section[toKeyName(h)]
				} else {
					h = section[toKeyCode(h)]
				}
			}

			// no handler... 
			if(h == null){
				doc = 'Nothing'				

			// a handler with doc (array)...
			} else if(typeof(h) == typeof([]) && handler.constructor.name == 'Array'){
				doc = h[1]

			// complex handler (object)...
			} else if(typeof(h) == typeof({})){
				// XXX
				

			// simple handler (function)...
			} else {
				doc = h.doc != null ? h.doc : h

			}

			// push the actual data...
			if(doc in res_sec){
				res_sec[doc].push(key)
			} else {
				res_sec[doc] = [key]
			}
		}
	}
	return res
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */

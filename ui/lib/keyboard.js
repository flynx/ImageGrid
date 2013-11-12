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
	16:		'Shift',	35:		'End',		 8:		'Backspace',
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
	// NOTE: to avoid conflicts with keys that have a code the same as
	// 		the value of a number key...
	// 			Ex:
	// 				'Backspace' (8) vs. '8' (56)
	// 				'Tab' (9) vs. '9' (57)
	// 		...all of the numbers start with a '#'
	// 		this is a problem due to JS coercing the types to string
	// 		on object attr access.
	// 			Ex:
	// 				o = {1: 2}
	// 				o[1] == o['1'] == true
	49: '#1',	50: '#2',	51: '#3',	52: '#4',	53: '#5',
	54: '#6', 	55: '#7',	56: '#8',	57: '#9',	48: '#0',

	// Punctuation...
	// top row...
	192: '`',		/* Numbers */		189: '-',	187: '=',
	// right side of keyboard...
				219: '[',	221: ']',	220: '\\',
				186: ';',	222: '\'',
	188: ',',	190: '.',	191: '/',
}


var _SHIFT_KEYS = {
	'`': '~',	'-': '_',	'=':'+',

	1: '!',		2: '@',		3: '#',		4: '$',		5: '%',
	6:'^',		7:'&',		8: '*',		9: '(',		0: ')',	

	'[': '{',		']': '}',		'\\': '|',
	';': ':',		'\'': '"',
	',': '<',		'.': '>',		'/': '?'
}


// build a reverse map of _SPECIAL_KEYS
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


// documentation wrapper...
function doc(text, func){
	func = func == null ? function(){return true}: func
	func.doc = text
	return func
}


// Build or normalize a modifier string. 
//
// Acceptable argument sets:
// 	- none				-> ""
// 	- true, false, true	-> "ctrl+shift"
// 	- true, false		-> "ctrl"
// 	- [true, false]		-> "ctrl"
// 	- 'alt+shift'		-> "alt+shift"
// 	- 'shift - alt'		-> "alt+shift"
//
function normalizeModifiers(c, a, s){
		if(c != null && c.constructor.name == 'Array'){
			a = c[1]
			s = c[2]
			c = c[0]
		}
		if(typeof(c) == typeof('str')){
			var modifiers = c
		} else {
			var modifiers = (c ? 'ctrl' : '') 
				+ (a ? ' alt' : '') 
				+ (s ? ' shift' : '')
		}

		// build the dormalized modifier string...
		var res = /ctrl/i.test(modifiers) ? 'ctrl' : ''
		res += /alt/i.test(modifiers) ? (res != '' ? '+alt' : 'alt') : ''
		res += /shift/i.test(modifiers) ? (res != '' ? '+shift' : 'shift') : ''

		return res
}


/* Key handler getter
 *
 * For doc on format see makeKeyboardHandler(...)
 *
 * modes can be:
 * 	- 'any'	(default)	- Get list of all applicable handlers up until
 * 							the first applicable ignore.
 * 	- 'all'				- Get ALL handlers, including ignores
 * 	- <mode>			- Get handlers for an explicit mode
 *
 * modifiers can be:
 * 	- '' (default)		- No modifiers
 * 	- '?'				- Return list of applicable modifiers per mode
 * 	- <modifier>		- Any of 'ctrl', 'alt' or 'shift' alone or in 
 * 							combination. 
 * 							Combinations MUST be ordered as shown above.
 * 							Combination elements are separated by '+'
 * 							Ex:
 * 								'ctrl+shift'
 * 							NOTE: 'shift+ctrl' is wrong.
 * 							NOTE: normalizeModifiers(...) can be used as
 * 								a reference, if in doubt.
 *
 * This will also resolve several shifted keys by name, for example:
 * 'shift-/' is the same as '?', and either can be used, but the shorter 
 * direct notation has priority (see _SHIFT_KEYS for supported keys).
 *
 *
 * Returns:
 * 	{
 * 		<mode>: <handler>,
 * 		...
 * 	}
 *
 *
 * NOTE: it is not possible to do a shift-? as it is already shifted.
 * NOTE: if a key is not handled in a mode, that mode will not be 
 * 		present in the resulting object.
 * NOTE: this will not unwrap lisp-style (see below) handlers.
 * NOTE: modes are prioritized by order of occurrence.
 * NOTE: modifiers can be a list of three bools...
 * 		(see: normalizeModifiers(...) for further information)
 *
 * XXX need an explicit way to prioritize modes, avoiding object attr 
 * 		ordering...
 * XXX check do we need did_handling here...
 *
 * XXX BUG explicitly given modes do not yield results if the pattern 
 * 		does not match...
 */
function getKeyHandlers(key, modifiers, keybindings, modes, shifted_keys){
	var chr = null
	var s_chr = null
	var did_handling = false
	modifiers = modifiers == null ? '' : modifiers
	modifiers = modifiers != '?' ? normalizeModifiers(modifiers) : modifiers
	modes = modes == null ? 'any' : modes
	shifted_keys = shifted_keys == null ? _SHIFT_KEYS : shifted_keys

	if(typeof(key) == typeof(123)){
		key = key
		chr = toKeyName(key)
	} else {
		chr = key
		key = toKeyCode(key)
	}

	// XXX this is not done yet...
	if(shifted_keys != false && /shift/i.test(modifiers)){
		var s_chr = shifted_keys[chr]
	}

	res = {}

	for(var mode in keybindings){

		// check if we need to skip this mode...
		if( !(modes == 'all'
			// explicit mode match...
			|| modes == mode
			// 'any' means we need to check the mode...
			|| (modes == 'any'
				// '*' allways matches...
				&& mode == '*'
				// match the mode...
				|| $(mode).length != 0))){
			continue
		}

		var bindings = keybindings[mode]

		if(s_chr != null && s_chr in bindings){
			var handler = bindings[s_chr]
			chr = s_chr
			modifiers = modifiers.replace(/\+?shift/i, '') 
		} else if(chr in bindings){
			var handler = bindings[chr]
		} else {
			var handler = bindings[key]
		}

		// alias...
		while( handler != null 
				&& (typeof(handler) == typeof(123) 
					|| typeof(handler) == typeof('str')
					|| typeof(handler) == typeof({}) 
						&& handler.constructor.name == 'Object') ){

			// do the complex handler aliases...
			if(typeof(handler) == typeof({}) && handler.constructor.name == 'Object'){
				// build modifier list...
				if(modifiers == '?'){
					break
				}
				if(modifiers in handler){
					if(typeof(handler[modifiers]) == typeof('str')){
						handler = handler[modifiers]
					} else {
						break
					}
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
					|| bindings.ignore != null 
						&& (bindings.ignore.indexOf(key) != -1 
							|| bindings.ignore.indexOf(chr) != -1)){
				did_handling = true
				// ignoring a key will stop processing it...
				if(modes == 'all' || mode == modes){
					res[mode] = 'IGNORE'
				} else {
					break
				}
			}
			continue
		}

		// complex handler...
		if(typeof(handler) == typeof({}) && handler.constructor.name == 'Object'){
			// build modifier list...
			if(modifiers == '?'){
				res[mode] = Object.keys(handler)
				did_handling = true
				continue
			}

			var callback = handler[modifiers]
			if(callback == null){
				callback = handler['default']
			}

			if(callback != null){
				res[mode] = callback

				did_handling = true
				continue
			}

		// simple callback...
		} else {
			// build modifier list...
			if(modifiers == '?'){
				res[mode] = 'none'
			} else {
				res[mode] = handler
			}

			did_handling = true
			continue
		}

		if(modes != 'all' && did_handling){
			break
		}
	}

	return res
}


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
 *			// NOTE: ignoring a key will stop processing it in other 
 *			//		compatible modes.
 * 			ignore: <ignored-keys>
 *
 *			// NOTE: a callback can have a .doc attr containing 
 *			//		documentation...
 * 			<key-def> : <callback>,
 *
 * 			<key-def> : [
 *				// this can be any type of handler except for an alias...
 * 				<handler>, 
 * 				<doc>
 * 			],
 *
 * 			<key-def> : {
 *				// modifiers can either have a callback or an alias as 
 *				// a value...
 *				// NOTE: when the alias is resolved, the same modifiers 
 *				//		will be applied to the final resolved handler.
 * 				default: <callback> | <key-def-x>,
 *
 *				// a modifier can be any single modifier, like shift or a 
 *				// combination of modifiers like 'ctrl+shift', in order 
 *				// of priority.
 *				// supported modifiers, ordered by priority, are:
 *				//	- ctrl
 *				//	- alt
 *				//	- shift
 *				// NOTE: if in doubt use normalizeModifiers(..) as a 
 *				//		reference...
 * 				<modifer>: [...],
 * 				...
 * 			},
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
 * 	- action -- any arbitrary string that is not in the above categories.
 *
 *
 * NOTE: actions,the last case, are used for alias referencing, they will
 * 		never match a real key, but will get resolved in alias searches.
 * NOTE: to test what to use as <key-def> use toKeyCode(..) / toKeyName(..).
 * NOTE: all fields are optional.
 * NOTE: if a handler explicitly returns false then that will break the 
 * 		event propagation chain and exit the handler.
 * 		i.e. no other matching handlers will be called.
 * NOTE: if more than one match is found all matching handlers will be 
 * 		called in sequence until one returns false explicitly.
 * NOTE: a <css-selector> is used as a predicate to select a section to 
 * 		use. if multiple selectors match something then multiple sections 
 * 		will be resolved in order of occurrence.
 * NOTE: the number keys are named with a leading hash '#' (e.g. '#8') 
 * 		to avoid conflicsts with keys that have the code with the same 
 * 		value (e.g. 'backspace' (8)).
 * NOTE: one can use a doc(<doc-string>, <callback>) as a shorthand to assign
 * 		a docstring to a handler.
 * 		it will only assign .doc attr and return the original function.
 *
 * XXX need an explicit way to prioritize modes...
 * XXX will aliases get resolved if they are in a different mode??
 */
function makeKeyboardHandler(keybindings, unhandled){
	if(unhandled == null){
		unhandled = function(){}
	}
	return function(evt){
		var did_handling = false
		var res = null

		// key data...
		var key = evt.keyCode

		// get modifiers...
		var modifiers = [evt.ctrlKey, evt.altKey, evt.shiftKey]

		//window.DEBUG && console.log('KEY:', key, chr, modifiers)

		var handlers = getKeyHandlers(key, modifiers, keybindings)

		for(var mode in handlers){
			var handler = handlers[mode]
			if(handler != null){

				// Array, lisp style with docs...
				if(typeof(handler) == typeof([]) && handler.constructor.name == 'Array'){
					// we do not care about docs here, so just get the handler...
					handler = handler[0]
				}

				did_handling = true
				res = handler(evt)

				if(res === false){
					break
				}
			}
		}
		if(!did_handling){
			return unhandled(key)
		}
		return res
	}
}


/* Build structure ready for conversion to HTML help.
* 
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
*
* NOTE: this will not add keys (key names) that are not explicit key names.
*/
// XXX do we need to normalize/pre-process keybindings???
// 		- might be a good idea to normalize the <modifiers>...
function buildKeybindingsHelp(keybindings, shifted_keys){
	shifted_keys = shifted_keys == null ? _SHIFT_KEYS : shifted_keys
	var res = {}
	var mode, title

	for(var pattern in keybindings){
		mode = keybindings[pattern]

		// titles and docs...
		title = mode.title == null ? pattern : mode.title
		res[title] = {
			doc: mode.doc == null ? '' : mode.doc
		}
		section = res[title]

		// handlers...
		for(var key in mode){
			if(key == 'doc' || key == 'title' || key == 'ignore'){
				continue
			}
			//var modifiers = getKeyHandlers(key, '?', keybindings, pattern)[pattern]
			var modifiers = getKeyHandlers(key, '?', keybindings, 'all')[pattern]
			modifiers = modifiers == 'none' || modifiers == undefined ? [''] : modifiers

			for(var i=0; i < modifiers.length; i++){
				var mod = modifiers[i]

				//var handler = getKeyHandlers(key, mod, keybindings, pattern)[pattern]
				var handler = getKeyHandlers(key, mod, keybindings, 'all')[pattern]

				// standard object doc...
				if('doc' in handler){
					var doc = handler.doc

				// lisp style...
				} else if(typeof(handler) == typeof([]) && handler.constructor.name == 'Array'){
					var doc = handler[1]

				// no doc...
				} else {
					if('name' in handler && handler.name != ''){
						var doc = handler.name
					} else {
						// XXX is this the right way to do this?
						var doc = handler
					}
				}

				// populate the section...
				// NOTE: we need a list of keys per action...
				if(doc in section){
					var keys = section[doc]
				} else {
					var keys = []
					section[doc] = keys
				}

				// translate shifted keys...
				if(shifted_keys != false && mod == 'shift' && key in shifted_keys){
					mod = ''
					key = shifted_keys[key]
				}

				// skip anything that is not a key...
				if(key.length > 1 && !(key in _KEY_CODES)){
					continue
				}

				keys.push((mod == '' || mod == 'default') ? key : (mod +'+'+ key))
			}

		}
	}

	return res
}


// Build a basic HTML table with keyboard help...
//
//	The table will look like this:
//
// 		<table class="keyboard-help">
//
// 			<!-- section head -->
// 			<tr class="section-title">
// 				<th colspan=2> SECTION TITLE <th>
// 			</tr>
// 			<tr class="section-doc">
// 				<td colspan=2> SECTION DESCRIPTION <td>
// 			</tr>
//
// 			<!-- section keys -->
// 			<tr>
// 				<td> KEYS <td>
// 				<td> ACTION DESCRIPTION <td>
// 			</tr>
//
// 			...
//
//		</table>
//
// NOTE: section are not separated in any way other than the <th> element.
// NOTE: the actual HTML is created by jQuery, so the table may get 
// 		slightly structurally changed, i.e. a <tbody> element will be 
// 		added etc.
//
function buildKeybindingsHelpHTML(keybindings){
	var doc = buildKeybindingsHelp(keybindings)

	var res = '<table class="keyboard-help">'
	for(var mode in doc){
		if(mode == 'doc'){
			continue
		}
		// section head...
		res += '  <tr class="section-title"><th colspan=2>' + mode + '</th></tr>\n' 
		mode = doc[mode]
		res += '  <tr class="section-doc"><td colspan=2>'+ mode.doc + '</td></tr>\n'

		// keys...
		for(var action in mode){
			if(action == 'doc'){
				continue
			}
			res += '  <tr><td>' + mode[action].join(', ') +'</td><td>'+ action + '</td></tr>\n'
		}
	}
	res += '</table>'

	return $(res)
}



/**********************************************************************
* Key binding editor...
*/

// XXX



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */

/**********************************************************************
* 
*
*
**********************************************************************/

//var DEBUG = DEBUG != null ? DEBUG : true

var CURSOR_SHOW_THRESHOLD = 10
var CURSOR_HIDE_TIMEOUT = 2000



/*********************************************************************/

// XXX revise...
function autoHideCursor(elem){
	elem = $(elem)
	elem
		.on('mousemove', function(evt){
			_cursor_pos = window._cursor_pos == null || $('.viewer').css('cursor') == 'auto' ?
						[evt.clientX, evt.clientY] 
					: _cursor_pos

			if(Math.abs(evt.clientX - _cursor_pos[0]) > CURSOR_SHOW_THRESHOLD 
					|| Math.abs(evt.clientY - _cursor_pos[1]) > CURSOR_SHOW_THRESHOLD){

				if(window._cursor_timeout != null){
					clearTimeout(_cursor_timeout)
				}

				$('.viewer').css('cursor', '')

			} else {
				_cursor_timeout = setTimeout(function(){
					if(Math.abs(evt.clientX - _cursor_pos[0]) < CURSOR_SHOW_THRESHOLD 
							|| Math.abs(evt.clientY - _cursor_pos[1]) < CURSOR_SHOW_THRESHOLD){
						$('.viewer').css('cursor', 'none')
					}
				}, CURSOR_HIDE_TIMEOUT)
			}
		})
	return elem
}



/*********************************************************************/
// vim:set ts=4 sw=4 nowrap :

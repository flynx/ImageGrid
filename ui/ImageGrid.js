/**********************************************************************
* 
*
*
*
* This should work over three contexts:
* 	- archive (full)
* 		full data available remotely
* 		handle global operations
* 	- local data (full or partial)
* 		full or partial set of data available locally
* 		handle global operations (if full data-set is available)
* 		handle local operations (if enough data is available)
* 	- local view (partial)
* 		only the rendered UI and cache
*
*
**********************************************************************/

var Context = {
	// the selection query used to get data...
	// NOTE: this should support operations to get next and prev batches if it's partial
	// XXX we do not care about this yet
	query: null,

	// this can be:
	// 	'full'		- indicating that all the data is available locally
	// 	'partial'	- indicating that only part of the data is available
	data_state: 'full',

	data: {
		// current image...
		current: null,

		// images, hashed by GUID...
		images: {
		},

		// list of ribbons...
		ribbons: [
			// list of GUIDs in sort order...
			[]
		],
		// list of marked GUIDs...
		marked: [
		],
	}

	view: null,

}


/**********************************************************************
* Helpers...
*/

// retrun viewer width in images...
function getViewImages(){
	// XXX
}



/**********************************************************************
* User actions...
*/

/* Focus an image...
*
* n can be:
* 	- position relative to current
* 		-1 is previous image, +1 next
* 	- GUID
* 		if GUID is present in context select it.
*/
function focusImage(n){
	// XXX
}

// shorthands...
function nextImage(){
	return focusImage(1)
}
function prevImage(){
	return focusImage(-1)
}
// NOTE: here n is the multiplier to the screen width of images...
function nextViewImages(n){
	n = n == null ? 1 : n
	return focusImage(getViewImages()*n)
}
function prevViewImages(n){
	n = n == null ? -1 : -n
	return focusImage(getViewImages()*n)
}

function firstImage(){
	// XXX
}
function lastImage(){
	// XXX
}




/* Focus a ribbon...
*
* n can be:
* 	- position relative to current
* 		-1 is previous image, +1 next
* 	- GUID (???)
* 		if GUID is present in context select it.
*
* NOTE: this will also focus the closest image...
*/
function focusRibbon(n){
	// XXX
}

// shorthands...
function ribbonAbove(n){
	n = n == null ? -1 : n
	return focusRibbon(n)
}
function ribbonBelow(n){
	n = n == null ? 1 : -n
	return focusRibbon(n)
}

function topRibbon(){
	// XXX
}
function bottomRibbon(){
	// XXX
}



/* Marking...
* 
* NOTE: n can be null, then current image is marked.
*/
function toggleMark(n){
	// XXX
}




/**********************************************************************
* vim:set sw=4 ts=4 :												 */

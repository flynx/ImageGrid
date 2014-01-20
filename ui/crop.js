/**********************************************************************
* 
* Ribbon Crop API
*
*
**********************************************************************/

var CROP_STACK = []

var CROP_MODES = []


/******************************************************* Crop Data ***/

function isViewCropped(){
	return CROP_STACK.length != 0
}


function getAllData(){
	if(!isViewCropped()){
		return DATA
	} else {
		return CROP_STACK[0]
	}
}


// NOTE: this will not update .current state...
// NOTE: when keep_ribbons is set, this may generate empty ribbons...
// NOTE: this requieres all data to be present, if currently viewing 
// 		server-side data, then cropping is a server-side operation...
// 		XXX another way to go here is to save the crop method and take 
// 			it into account when loading new sections of data...
//
// XXX should this set the .current to anything but null or the first elem???
function makeCroppedData(gids, keep_ribbons, keep_unloaded_gids){
	gids = fastSortGIDsByOrder(gids)
	var res = {
		varsion: DATA_VERSION,
		current: null,
		ribbons: [],
		order: DATA.order.slice(),
	}

	// remove any gid that is not in IMAGES or is not loaded...
	if(!keep_unloaded_gids){
		var loaded = []
		$.each(DATA.ribbons, function(i, e){ loaded = loaded.concat(e) })

		// NOTE: if IMAGES contains only part of the data loadable this will 
		// 		be wrong...
		gids = gids.filter(function(e){ 
			return e in IMAGES && loaded.indexOf(e) >= 0 
		})
	}

	// flat single ribbon crop...
	if(!keep_ribbons){
		res.ribbons[0] = gids

	// keep the ribbon structure...
	} else {
		$.each(DATA.ribbons, function(_, e){
			e = e.filter(function(ee){ return gids.indexOf(ee) >= 0 })
			// skip empty ribbons...
			if(e.length != 0){
				res.ribbons.push(e)
			}
		})
	}

	return res
}


// Crop data to given gids and set viewer state...
//
// Returns original state
//
// NOTE: if keep_ribbons is not set this will ALWAYS build a single ribbon
// 		data-set...
function cropDataTo(gids, keep_ribbons, keep_unloaded_gids){
	var prev_state = DATA
	var cur = DATA.current
	var r = keep_ribbons ? getRibbonIndex() : 0

	var new_data = makeCroppedData(gids, keep_ribbons, keep_unloaded_gids)

	// do nothing if there is no change...
	// XXX is there a better way to compare states???
	if(JSON.stringify(DATA.ribbons) == JSON.stringify(new_data.ribbons)){
		return DATA
	}

	CROP_STACK.push(prev_state)
	DATA = new_data

	cur = getGIDBefore(cur, r)
	cur = cur == null ? DATA.ribbons[r][0] : cur
	DATA.current = cur 

	reloadViewer()
	updateImages()

	return prev_state
}


function uncropData(){
	if(!isViewCropped()){
		return DATA
	}
	var prev_state = DATA
	var cur = DATA.current

	DATA = CROP_STACK.pop()

	// check if cur exists in data being loaded...
	if($.map(DATA.ribbons, 
			function(e, i){ return e.indexOf(cur) >= 0 }).indexOf(true) >= 0){
		// keep the current position...
		DATA.current = cur
	}

	reloadViewer()
	updateImages()

	return prev_state
}


function showAllData(){
	var prev_state = DATA
	var cur = DATA.current

	if(CROP_STACK.length != 0){
		DATA = getAllData()
		CROP_STACK = []

		// XXX do we need to check if this exists???
		// 		...in theory, as long as there are no global destructive 
		// 		operations, no.
		// keep the current position...
		DATA.current = cur

		reloadViewer()
		updateImages()
	}

	return prev_state
}


// Helpers for making crop modes and using crop...

// Make a generic crop mode toggler
//
// NOTE: This will add the toggler to CROP_MODES, for use by 
// 		uncropLastState(...)
// NOTE: crop modes are exclusive -- it is not possible to enter one crop
// 		mode from a different crop mode
//
// XXX add "exclusive" crop option -- prevent other crop modes to enter...
function makeCropModeToggler(cls, crop){
	var res = createCSSClassToggler(
			'.viewer',
			//cls + ' cropped-mode',
			cls,
			/* XXX make this an option...
			function(action){
				// prevent mixing marked-only and single-ribbon modes...
				if(action == 'on' 
						&& isViewCropped()
						&& res('?') != 'on'){
					return false
				}
			},
			*/
			function(action){
				if(action == 'on'){
					showStatusQ('Cropping current ribbon...')
					crop()
				} else {
					showStatusQ('Uncropping to all data...')
					showAllData()
				}
			})
	CROP_MODES.push(res)
	return res
}


// Uncrop to last state and there is no states to uncrop then exit 
// cropped mode.
//
// NOTE: this will exit all crop modes when uncropping the last step.
function uncropLastState(){
	// do nothing if we aren't in a crop mode...
	if(!isViewCropped()){
		return
	}

	// exit cropped all modes...
	if(CROP_STACK.length == 1){
		$.each(CROP_MODES, function(_, e){ e('off') })

	// ucrop one state...
	} else {
		showStatusQ('Uncropping...')
		uncropData()
	}
}


/**********************************************************************
* Dialogs... 
*/

function cropImagesDialog(){

	updateStatus('Crop...').show()

	var alg = 'Crop ribbons: |'+
		'Use Esc and Shift-Esc to exit crop modes.'+
		'\n\n'+
		'NOTE: all crop modes will produce a single ribbon unless\n'+
		'otherwise stated.'

	cfg = {}
	cfg[alg] = [
		'Marked images', 
		'Marked images (keep ribbons)', 
		'Bookmarked images', 
		'Bookmarked images (keep ribbons)', 
		'Current ribbon', 
		'Current ribbon and above | Will merge the images into a single ribbon.',
		'Current ribbon and above (keep ribbons)'
	]

	formDialog(null, '', 
			cfg,
			'OK', 
			'cropImagesDialog')
		.done(function(res){
			res = res[alg]

			// NOTE: these must be in order of least-specific last...
			if(/Marked.*keep ribbons/.test(res)){
				var method = toggleMarkedOnlyWithRibbonsView

			} else if(/Marked/.test(res)){
				var method = toggleMarkedOnlyView

			} else if(/Bookmarked.*keep ribbons/i.test(res)){
				var method = toggleBookmarkedOnlyWithRibbonsView

			} else if(/Bookmarked/.test(res)){
				var method = toggleBookmarkedOnlyView

			} else if(/Current ribbon and above.*keep ribbons/.test(res)){
				var method = toggleCurrenAndAboveRibbonsMode

			} else if(/Current ribbon and above/.test(res)){
				var method = toggleCurrenAndAboveRibbonMode

			} else if(/Current ribbon/.test(res)){
				var method = toggleSingleRibbonMode
			}

			showStatusQ('Cropped: '+res+'...')

			method('on')
		})
		.fail(function(){
			showStatusQ('Crop: canceled.')
		})
}


function filterImagesDialog(){
	updateStatus('Filter...').show()

	cfg = {}
	cfg['GID |'
			+'Use gid or gid tail part to find an\n'
			+'image.\n'
			+'\n'
			+'NOTE: use of at least 6 characters is\n'
			+'recommended.'] = ''
	cfg['sep0'] = '---'
	cfg['Name'] = ''
	cfg['Path |'
			+'This applies to the non-common\n'
			+'part of the relative path only.'] = ''
	cfg['Comment'] = ''
	cfg['Tags |'
			+'An image will match if at least\n'
			+'one tag matches'] = ''
	// XXX date...
	cfg['Rotated'] = {select: [
		'',
		'no',
		'90&deg; or 270&deg;',
		'0&deg; or 180&deg;',
		'90&deg; only',
		'180&deg; only',
		'270&deg; only'
	]}
	cfg['Flipped'] = {select: [
		'',
		'no',
		'any',
		'vertical',
		'horizontal'
	]}
	cfg['sep1'] = '---'
	cfg['Marked'] = {select: [
		'',
		'yes',
		'no'
	]}
	cfg['Bookmarked'] = {select: [
		'',
		'yes',
		'no'
	]}
	cfg['sep2'] = '---'
	cfg['Ribbon'] = {select: [
		'all',
		'current only'
	]}
	cfg['Keep ribbons'] = false

	formDialog(null, 
			'Filter images |'
				+'All filter text fields support\n'
				+'regular expressions.\n'
				+'\n'
				+'Prepending a "!" to any text filter\n'
				+'will negate it, selecting unmatching\n'
				+'images only.\n'
				+'\n'
				+'Only non-empty fields are used\n'
				+'for filtering.',
			cfg,
			'OK', 
			'filterImagesDialog')
		.done(function(res){
			var gids

			showStatusQ('Filtering...')

			// XXX date...

			var filter = {}
			// build the filter...
			for(var field in res){
				// this will search for gid or gid part at the end of a gid...
				if(/^GID/.test(field) && res[field].trim() != ''){
					filter['id'] = res[field] + '$'

				} else if(/^Name/.test(field) && res[field].trim() != ''){
					filter['name'] = res[field]

				} else if(/^Path/.test(field) && res[field].trim() != ''){
					filter['path'] = res[field]

				} else if(/^Comment/.test(field) && res[field].trim() != ''){
					filter['comment'] = res[field]

				} else if(/^Tags/.test(field) && res[field].trim() != ''){
					filter['tags'] = res[field]

				} else if(/^Rotated/.test(field) && res[field].trim() != ''){
					if(res[field] == 'no'){
						filter['orientation'] = '^0$|undefined|null'
					} else if(/or/.test(res[field])){
						filter['orientation'] = res[field]
							.split('or')
							.map(function(e){
								e = parseInt(e)
								if(e == 0){
									return '^0$|undefined|null'
								}
								return e
							})
							.join('|')
					} else {
						filter['orientation'] = RegExp(parseInt(res[field]))
					}

				} else if(/^Flipped/.test(field) && res[field].trim() != ''){
					if(res[field] == 'no'){
						filter['flipped'] = 'undefined|null'
					} else if(res[field] == 'any'){
						filter['flipped'] = '.*'
					} else {
						filter['flipped'] = res[field]
					}

				} else if(/^Bookmarked/.test(field) && res[field].trim() != ''){
					if(res[field] == 'yes'){
						gids = getBookmarked(gids)
					} else {
						gids = getUnbookmarked(gids)
					}

				} else if(/^Marked/.test(field) && res[field].trim() != ''){
					if(res[field] == 'yes'){
						gids = getMarked(gids)
					} else {
						gids = getUnmarked(gids)
					}

				} else if(/^Ribbon/.test(field) && res[field].trim() != 'all'){
					if(res[field] == 'current only'){
						gids = getRibbonGIDs(gids)
					}
				}
			}

			var keep_ribbons = res['Keep ribbons']

			gids = filterGIDs(filter, gids)

			if(gids.length > 0){
				cropDataTo(gids, keep_ribbons)
			} else {
				showStatusQ('Filter: nothing matched.')
			}
		})
		.fail(function(){
			showStatusQ('Filter: canceled.')
		})
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */

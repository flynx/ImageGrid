/**********************************************************************
* 
* Data generation 4 implementation.
*
*
* XXX might be a good idea to make a set of universal argument parsing 
* 	utils...
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var sha1 = require('ext-lib/sha1')

var types = require('lib/types')
var object = require('lib/object')

var tags = require('imagegrid/tags')
var formats = require('imagegrid/formats')



/*********************************************************************/

// NOTE: this actively indicates the format used, changing this will 
// 		affect the loading of serialized data, do not change unless you
// 		know what you are doing.
// 		...this is done to gradually migrate to new format versions with
// 		minimal changes.
var DATA_VERSION =
module.DATA_VERSION = '3.1'



/*********************************************************************/
//
// General format info...
//
// Version format:
// 	<major>.<minor>
//
// Major version changes mean a significant incompatibility.
//
// Minor version changes mean some detail changed and can be handled
// by it's specific handler seamlessly. Backwards compatible.
//
//
// For more info see:
// 	DATA			- main data
// 	IMAGES			- image data
// 	MARKED			- marks data
// 	BOOKMARKS		- bookmarks data
// 	BOOKMARKS_DATA	- bookmarks metadata
// 	TAGS			- tag data
//
//
// Data format change history:
// 	3.1 - Moved to the new tag implementation -- changed the tag JSON 
// 		format:
// 			{
// 				aliases: {
// 					<alias>: <tag>,
// 				},
// 				persistent: [<tag>, ...],
// 				tags: {
// 					<tag>: [<gid>, ...],
// 					...
// 				}
// 			}
// 			(see: tags.js for more info)
// 			(still in development)
// 	3.0	- Gen4 DATA format, introduced several backwards incompatible 
// 		changes:
// 			- added ribbon GIDs, .ribbons now is a gid indexed object
// 			- added .ribbon_order
// 			- added .base ribbon
// 			- ribbons are now sparse in memory but can be compact when
// 			  serialized.
// 			- auto-convert from gen1 (no version) and gen3 (2.*) on load
// 	2.3 - Minor update to sorting restrictions
// 			- now MARKED and BOOKMARKS do not need to be sorted 
// 			  explicitly in json, they are now sorted as a side-effect 
// 			  of being sparse.
// 			  This negates some restrictions posed in 2.1, including 
// 			  conversion of 2.0 data.
// 			  NOTE: TAGS gid sets are still compact lists, thus are 
// 			  		actively maintained sorted.
// 			  		...still thinking of whether making them sparse is
// 			  		worth the work...
// 	2.2 - Minor update to how data is handled and saved
// 			- now DATA.current is saved separately in current.json,
// 			  loading is done from current.json and if not found from
// 			  data.json.
// 			  the file is optional.
// 			- data, marks, bookmarks, tags are now saved only if updated
// 	2.1 - Minor update to format spec,	
// 			- MARKED now maintained sorted, live,
// 			- will auto-sort marks on load of 2.0 data and change 
// 			  data version to 2.1, will need a re-save,
// 	2.0 - Gen3 data format, still experimental,
// 			- completely new and incompatible structure,
// 			- use convertDataGen1(..) to convert Gen1 to 2.0 
// 			- used for my archive, not public,
// 			- auto-convert form gen1 on load...
// 	none - Gen1 data format, mostly experimental,
// 			- has no explicit version set,
// 			- not used for real data.
//
//
// NOTE: Gen1 and Gen3 refer to code generations rather than data format
// 		iterations, Gen2 is skipped here as it is a different project 
// 		(PortableMag) started on the same code base as ImageGrid.Viewer
// 		generation 1 and advanced from there, back-porting some of the 
// 		results eventually formed Gen3...
//
//
/*********************************************************************/
//
// TODO save current crop/state as JSON (named)...
// TODO save current order (named)...
// TODO auto-save manual sort -- on re-sort...
//
//
/*********************************************************************/

// decide to use a hashing function...
var hash = typeof(sha1) != 'undefined' ?
	sha1.hash.bind(sha1)
	: function(g){ return g }


/*********************************************************************/
// Data...

var DataClassPrototype = {
	// NOTE: we consider the input list sorted...
	fromArray: function(list){
		var res = new Data()
		// XXX make a real ribbon gid...
		var gid = res.newGID()
		res.order = list
		res.ribbon_order.push(gid)
		res.ribbons[gid] = list.slice()

		res.focusImage(list[0])
		res.setBase(gid)

		return res },
	// XXX is this the right way to construct data???
	fromJSON: function(data){
		//return new Data().load(data)
		return new this().load(data) },
}

var DataPrototype = {

	get version(){ 
		return DATA_VERSION },


	/*****************************************************************/
	//
	// Base Terminology:
	// 	- gen1 methods
	// 		- use the data API/Format
	// 		- use other gen1 methods
	// 	- gen2 methods
	// 		- do NOT use the data API/Format
	// 		- use other methods from any of gen1 and gen2
	//
	// NOTE: only gen2 methods are marked.
	//
	//
	/****************************************************** Format ***/
	//
	// 	.current (gid)
	// 		gid of the current image
	// 		
	// 		NOTE: if no current image is set explicitly this defaults 
	// 			to first image in first ribbon, or first in .order.
	//
	//
	// 	.base (gid)
	// 		gid of the base ribbon
	//
	// 		NOTE: if no base ribbon is explicitly set, this defaults to
	// 			last ribbon.
	// 			This may not seem logical at first but this is by design
	// 			behavior, the goal is to keep all sets not explicitly
	// 			aligned (i.e. sorted) be misaligned by default.
	//
	//
	// 	.order
	// 		List of image gids setting the image order
	//
	// 		format:
	//	 		[ gid, .. ]
	//
	//	 	NOTE: this list may contain gids not loaded at the moment, 
	//	 		a common case for this is when data is cropped.
	//
	//
	// 	.ribbon_order
	// 		List of ribbon gids setting the ribbon order.
	//
	// 		format:
	// 			[ gid, .. ]
	//
	//
	// 	.ribbons
	// 		Dict of ribbons, indexed by ribbon gid, each ribbon is a 
	// 		sparse list of image gids.
	//
	// 		format:
	// 			{ gid: [ gid, .. ], .. }
	//
	// 		NOTE: ribbons are sparse...
	// 		NOTE: ribbons can be compact when serialized...
	//
	//
	/*****************************************************************/

	ribbon_order: null,
	ribbons: null,

	//__current: null,
	get current(){
		return this.__current = this.__current 
			|| this.getImages(this.ribbon_order[0])[0]
			|| this.order[0] },
	set current(value){
		this.focusImage(value) },

	//__base: null,
	get base(){
		return this.__base || this.ribbon_order[0] },
	set base(value){
		this.__base = value in this.ribbons ?
			this.getRibbon(value)
			: value },

	// NOTE: experiments with wrapping data in Proxy yielded a 
	// 		significant slowdown on edits...
	//__order: null,
	get order(){
		return this.__order },
	set order(value){
		delete this.__order_index
		this.__order = value },
	//__order_index: null,
	get order_index(){
		return this.__order_index = 
			this.__order_index || this.order.toKeys() },



	/******************************************************* Utils ***/

	// Normalize gids...
	//
	// 	Get all gids...
	// 	.normalizeGIDs('all')
	// 		-> gids
	// 		NOTE: this is a shorthand for .getImages('all')
	//
	// 	Get all loaded gids...
	// 	.normalizeGIDs('loaded')
	// 		-> gids
	// 		NOTE: this is a shorthand for .getImages('loaded')
	//
	// 	Normalize list of gids/keywords
	// 	.normalizeGIDs(gid|keyword, ..)
	// 	.normalizeGIDs([gid|keyword, ..])
	// 		-> gids
	//
	//
	// Supported keywords are the same as for .getImage(..)
	//
	// XXX is this needed here???
	normalizeGIDs: function(gids){
		var that = this
		// direct keywords...
		if(gids == 'all' || gids == 'loaded'){
			return this.getImages(gids) }

		gids = arguments.length > 1 ? [...arguments] : gids
		gids = gids instanceof Array ? gids : [gids]

		return gids
			.map(function(gid){ return that.getImage(gid) }) },

	// Sort images via .order...
	//
	// NOTE: this will place non-gids at the end of the list...
	//
	// XXX is this faster than .makeSparseImages(gids).compact() ???
	// 		...though this will not remove non-gids... 
	sortViaOrder: function(gids){
		var index = this.order_index
		var orig = gids.toKeys() 
		return gids
			.sort(function(a, b){ 
				return a in index && b in index ?
						index[a] - index[b]
					: a in index ?
						-1
					: b in index ?
						1
					: orig[a] - orig[b] }) },

	// Make a sparse list of image gids...
	//
	// 	Make sparse list out of gids...
	// 	.makeSparseImages(gids)
	// 		-> list
	//
	// 	Make sparse list out of gids and drop gids not in .order...
	// 	.makeSparseImages(gids, true)
	// 	.makeSparseImages(gids, null, null, true)
	// 		-> list
	// 		NOTE: this sets drop_non_order_gids...
	//
	// 	Place gids into their .order positions into target...
	// 	.makeSparseImages(gids, target)
	// 		-> list
	// 		NOTE: items in target on given gid .order positions will 
	// 			get overwritten...
	//
	// 	Place gids into their .order positions into target and reposition 
	// 	overwritten target items...
	// 	.makeSparseImages(gids, target, true)
	// 		-> list
	// 		NOTE: this sets keep_target_items...
	//
	// 	Plase gids into their .order positions into target and reposition 
	// 	overwritten target items and drop gids not in .order...
	// 	.makeSparseImages(gids, target, true, true)
	// 		-> list
	// 		NOTE: this sets keep_target_items and drop_non_order_gids...
	//
	//
	// This uses .order as the base for ordering the list.
	//
	// By default items in gids that are not present in .order are 
	// appended to the output/target tail after .order.length, which ever
	// is greater (this puts these items out of reach of further calls 
	// of .makeSparseImages(..)). 
	// Setting drop_non_order_gids to true will drop these items from 
	// output.
	//
	//
	// NOTE: this can be used to re-sort sections of a target ribbon, 
	// 		but care must be taken not to overwrite existing data...
	// NOTE: if target is given some items in it might get pushed out
	// 		by the new gids, especially if target is out of sync with 
	// 		.order, this can be avoided by setting keep_target_items 
	// 		(see next for more info).
	// 		Another way to deal with this is to .makeSparseImages(target)
	// 		before using it as a target.
	// NOTE: keep_target_items has no effect if target is not given...
	makeSparseImages: function(gids, target, keep_target_items, drop_non_order_gids){
		if(arguments.length == 2 && target === true){
			drop_non_order_gids = true
			target = null }
		// avoid mutating gids...
		gids = gids === target || keep_target_items ? 
			gids.slice() 
			: gids
		target = target == null ? [] : target

		var order = this.order
		//var order_idx = order.toKeys()
		// XXX to cache order index we need to update it every time we change order...
		var order_idx = this.order_index || order.toKeys()

		var rest = []

		for(var i=0; i < gids.length; i++){
			var e = gids[i]

			// skip undefined...
			if(e === undefined 
					// if the element is in its place alredy do nothing...
					|| (e == order[i] && e == target[i])){
				continue }

			var j = order_idx[e]

			if(j >= 0){
				// save overwritten target items if keep_target_items 
				// is set...
				var o = target[j]
				keep_target_items 
					&& o != null 
					// if the item is already in gids, forget it...
					// NOTE: this is to avoid juggling loops...
					&& gids.includes(o)
					// look at o again later...
					// NOTE: we should not loop endlessly here as target
					// 		will eventually get exhausted...
					&& gids.push(o)

				target[j] = e

			// handle elements in gids that are not in .order
			} else if(!drop_non_order_gids){
				rest.push(e) } }

		// avoid duplicating target items...
		// XXX not yet sure here what is faster, .toKeys(..) or Set(..)
		//var target_idx = target.toKeys()
		var target_idx = new Set(target)
		rest = rest
			//.filter(function(e){ return e in target_idx })
			.filter(function(e){ return target_idx.has(e) })

		if(rest.length > 0){
			target.length = Math.max(order.length, target.length)
			target.splice(target.length, 0, ...rest) }

		return target },

	// Merge sparse images...
	//
	// NOTE: this expects the lists to already be sparse and consistent,
	// 		if not this will return rubbish...
	mergeSparseImages: function(...lists){
		var res = []
		for(var i=0; i < this.order.length; i++){
			var e = null
			lists
				.forEach(function(l){
					e = e == null ? l[i] : e })
			e 
				&& (res[i] = e) }
		return res },

	// Remove duplicate items from list in-place...
	//
	// NOTE: only the first occurrence is kept...
	// NOTE: this is slow-ish...
	removeDuplicates: function(lst, skip_undefined){
		skip_undefined = skip_undefined == null ? 
			true 
			: skip_undefined
		var lst_idx = lst.toKeys()
		for(var i=0; i < lst.length; i++){
			if(skip_undefined && lst[i] == null){
				continue }
			if(lst_idx[lst[i]] != i){
				lst.splice(i, 1)
				i -= 1 } }
		return lst },

	// List of sparse image set names...
	//
	// NOTE: this is used mostly by .eachImageList(..), not intended for
	// 		client use.
	__gid_lists: ['ribbons', 'groups'],

	// Iterate through image lists...
	//
	// 	.eachImageList(func)
	// 		-> this
	//
	//
	// This accepts a function:
	// 		func(list, key, set)
	//
	// Where:
	// 		list	- the sparse list of gids
	// 		key		- the list key in set
	// 		set		- the set name
	//
	// The function is called in the context of the data object.
	//
	// The arguments can be used to access the list directly like this:
	// 	this[set][key]	-> list
	//
	//
	// Set order attribute is used if available to determine the key 
	// iteration order.
	// For 'ribbons' the order is determined as follows:
	// 		.ribbons_order + any missing keys
	// 		.ribbon_order + any missing keys
	// 		Object.keys(this[ribbons])
	//
	// XXX not sure if we should keep .<set>_order processing as-is, 
	// 		might a good idea just to drop it...
	eachImageList: function(func){
		var that = this
		this.__gid_lists.forEach(function(k){
			var lst = that[k]
			if(lst == null){
				return }
			var keys = (that[k + '_order'] 
					|| that[k.replace(/s$/, '') + '_order'] 
					|| [])
				.concat(Object.keys(lst))
				.unique()
			//Object.keys(lst)
			keys
				.forEach(function(l){
					func.call(that, lst[l], l, k) }) })
		return this },

	// Generate a GID...
	//
	// If no arguments are given then a unique gid will be generated.
	//
	// XXX revise...
	newGID: function(str, nohash){
		// prevent same gids from ever being created...
		// NOTE: this is here in case we are generating new gids fast 
		// 		enough that Date.now() produces identical results for 2+
		// 		consecutive calls...
		var t = module.__gid_ticker = (module.__gid_ticker || 0) + 1

		var p = typeof(location) != 'undefined' ? location.hostname : ''

		// if we are on node.js add process pid
		if(typeof(process) != 'undefined'){
			p += process.pid }

		// return string as-is...
		if(nohash){
			return str || p+'-'+t+'-'+Date.now() }

		// make a hash...
		var gid = hash(str || (p+'-'+t+'-'+Date.now()))

		// for explicit string return the hash as-is...
		if(str != null){
			return gid }

		// check that the gid is unique...
		while(this.ribbon_order.includes(gid)
				|| this.order.includes(gid)){
			gid = hash(p+'-'+t+'-'+Date.now()) }

		return gid },
	

	// Clear elements from data...
	//
	// 	Clear all data...
	// 	.clear()
	// 	.clear('*')
	// 	.clear('all')
	// 		-> data
	//
	// 	Clear empty ribbons...
	// 	.clear('empty')
	// 		-> data
	//
	// 	Clear images from .order that are not in any ribbon...
	// 	.clear('unloaded')
	// 		-> data
	//		NOTE: this may result in empty ribbons...
	//
	// 	Clear duplicate gids...
	// 	.clear('dup')
	// 	.clear('duplicates')
	// 		-> data
	//
	// 	Clear gid(s) form data...
	// 	.clear(gid)
	// 	.clear([gid, ..])
	// 		-> data
	// 		NOTE: gid can be either image or ribbon gid in any order...
	//
	//
	// Two extra arguments are considered:
	// 	- deep		- if set to true (default), when cleared a ribbon all
	// 				  images within that ribbon will also be cleared.
	// 	- clear_empty
	// 				- if true (default), empty ribbons will be removed 
	// 				  after all gids are cleared.
	// 				  this is equivalent to calling:
	// 				  	.clear('empty')
	//
	//
	// NOTE: at this point this will not set .base and .current but this
	// 		will reset them to null if a base ribbon or current image is
	// 		cleared...
	// 		thus setting appropriate .base and .current values is the 
	// 		responsibility of the caller.
	//
	// XXX should this support gid keywords like 'current'???
	clear: function(gids, deep, clear_empty){
		var that = this
		gids = gids || 'all'
		deep = deep == null ? true : false
		clear_empty = clear_empty == null ? true : false 

		// clear all data...
		if(gids == '*' || gids == 'all'){
			this._reset()

		// clear empty ribbons only...
		} else if(gids == 'unloaded'){
			this.order = this.getImages('loaded')
			this.updateImagePositions('remove')

		// clear duplicates...
		} else if(gids == 'dup' || gids == 'duplicates'){
			// horizontal...
			this.removeDuplicates(this.order)
			this.updateImagePositions()

			// vertical...
			// if a gid is in more than one ribbon keep only the top 
			// occurrence...
			this.order
				.forEach(function(gid, i){
					var found = false
					that.ribbon_order
						.forEach(function(r){
							r = that.ribbons[r]

							if(found){
								delete r[i]

							} else if(r[i] != null){
								found = true } }) })
			delete this.__order_index

		// clear empty ribbons only...
		} else if(gids == 'empty'){
			for(var r in this.ribbons){
				this.ribbons[r].len == 0
					&& this.clear(r) }

		// clear gids...
		} else {
			var ribbons = []
			gids = gids instanceof Array ? gids : [gids]
			// split ribbon and image gids...
			gids = gids
				.filter(function(gid){
					return gid in that.ribbons ?
						!ribbons.push(gid)
						: true })

			// remove ribbons...
			ribbons
				.forEach(function(gid){
					var i = that.ribbon_order.indexOf(gid)

					// clear from order...
					that.ribbon_order.splice(i, 1)

					// clear from ribbons...
					var images = that.ribbons[gid]
					delete that.ribbons[gid]

					// remove ribbon images...
					deep
						&& (gids = gids.concat(images))

					// no more ribbons left...
					if(that.ribbon_order.length == 0){
						delete that.__base

					// shift base up or to first image...
					} else if(that.base == gid){
						that.setBase(Math.max(0, i-1)) } })

			// remove images...
			var order = this.order
				.filter(function(g){ return gids.indexOf(g) < 0 })

			// handle current image...
			if(gids.indexOf(this.current) >= 0){
				var r = this.getImages('current')
					.filter(function(g){ return order.indexOf(g) >= 0 })

				// attempt to first get next/prev within the current ribbon...
				r = r.length > 0 ? r : order

				this.current = 
					this.getImage(this.current, 'after', r)
					|| this.getImage(this.current, 'before', r) }

			// do the actual removal...
			// NOTE: splicing fixed image indexes is faster than 
			// 		.updateImagePositions('remove')
			this.makeSparseImages(gids)
				// NOTE: we move from the tail to account for shifting 
				// 		indexes on removal...
				.reverse()
				.forEach(function(gid){
					var i = that.order.indexOf(gid)
					that.eachImageList(function(lst){ 
						lst.splice(i, 1) }) })
			this.order = order


			// cleanup...
			clear_empty
				&& this.clear('empty') }

		return this },

	// Replace image gid...
	//
	// NOTE: if to exists then it will get overwritten.
	replaceGID: function(from, to){
		if(from in this.ribbons){
			// ribbons...
			var ribbon = this.ribbons[from]
			delete this.ribbons[from]
			this.ribbons[to] = ribbon

			// ribbon order...
			this.ribbon_order.splice(this.ribbon_order.indexOf(from), 1, to)

			// base ribbon...
			this.__base = this.__base == from ? to : this.__base

		} else {
			from = this.getImage(from)
			var i = this.getImageOrder(from)

			var t = this.getImage(to)

			if(t != -1 && t != null){
				return
			}

			// current...
			if(from == this.current){
				this.current = to
			}
			// order...
			this.order[i] = to
			// image lists...
			this.eachImageList(function(list){
				list[i] != null
					&& (list[i] = to) })
			// XXX EXPERIMENTAL: order_index
			delete this.order_index[from]
			this.order_index[to] = i }
		return this },



	/*********************************************** Introspection ***/

	get length(){
		return this.order.length },
	get ribbonLength(){
		return this.getImages(this.getRibbon()).len },


	// Get image
	//
	//	Get current image:
	//	.getImage()
	//	.getImage('current')
	// 		-> gid
	//
	// 	Check if image is loaded/exists:
	// 	.getImage(gid)
	// 		-> gid
	// 		-> null
	//
	// 	Get image or closest to it from list/ribbon:
	// 	.getImage(gid, list|ribbon)
	// 		-> gid
	// 		-> null
	// 		NOTE: null is returned if image does not exist.
	//
	// 	Get image by order in ribbon: 
	// 	.getImage(n)
	// 	.getImage(n, ribbon)
	// 		-> gid
	// 		-> null
	//		NOTE: n can be negative, thus getting an image from the tail.
	// 		NOTE: the second argument must not be an int (ribbon order)
	// 				to avoid conflict with the offset case below.
	// 		NOTE: null is returned if image does not exist.
	//
	// 	Get image by global order: 
	// 	.getImage(n, 'global')
	// 		-> gid
	// 		-> null
	//		NOTE: n can be negative, thus getting an image from the tail.
	// 		NOTE: this is similar to .order[n], aside from negative index
	// 				processing.
	// 		NOTE: null is returned if image does not exist.
	//
	// 	Get first or last image in ribbon:
	// 	.getImage('first'[, ribbon])
	// 	.getImage('last'[, ribbon])
	// 		-> gid
	// 		-> null (XXX empty ribbon??? ...test!)
	// 		NOTE: the second argument must be .getRibbon(..) compatible.
	// 		NOTE: to get global first/last image use the index, e.g.:
	// 			.getImage(0) / .getImage(-1)
	// 		NOTE: to reference relative ribbon 'before'/'after' keywords 
	// 			are ignored, use 'above'/'prev' or 'below'/'next' instead.
	// 			This is done foe uniformity with:
	// 				.getImage(gid|order, 'before'|'after', ...)
	// 			...see below for more info.
	//
	// 	Get image closest to current or a specific image:
	// 	.getImage('before'[, list|ribbon])
	// 	.getImage(gid|order, 'before'[, list|ribbon])
	// 		-> gid
	// 		-> null
	// 	.getImage('after'[, list|ribbon])
	// 	.getImage(gid|order, 'after'[, list|ribbon])
	// 		-> gid
	// 		-> null
	// 		NOTE: null is returned if there is no image before/after the
	// 				current image in the given list/ribbon, e.g. the 
	// 				current image is first/last resp.
	// 		NOTE: in both the above cases if gid|order is found explicitly
	// 			it will be returned.
	//
	// 	Get image closest to current in list/ribbon (special case):
	// 	.getImage(list|ribbon[, 'before'|'after'])
	// 		-> gid
	// 		-> null
	// 		NOTE: null is returned if there is no image before/after the
	// 				current image in the given list/ribbon, e.g. the 
	// 				current image is first/last resp.
	// 		NOTE: 'before' is default.
	// 		NOTE: the first argument must not be a number.
	//
	//
	// 	Get next/prev image (offset of 1):
	// 	.getImage('next')
	// 	.getImage('prev')
	// 	.getImage(gid|order, 'next'[, list|ribbon])
	// 	.getImage(gid|order, 'prev'[, list|ribbon])
	// 		-> gid
	//
	// 	Get image at an offset from a given image:
	// 	.getImage(gid|order, offset[, list|ribbon])
	// 		-> gid
	// 		-> null
	// 		NOTE: null is returned if there is no image at given offset.
	//		NOTE: offset is calculated within the same ribbon...
	//
	// NOTE: If gid|order is not given, current image is assumed.
	// 		Similarly, if list|ribbon is not given then the current 
	// 		ribbon is used.
	// NOTE: if input gid is invalid this will return -1
	// NOTE: the following are equivalent:
	// 			D.getImage('current', -1, R)
	// 			D.getImage('before', R) 
	// 			D.getImage('current', 'before', R)
	// 		where D is a Data object and R a ribbon id/index different 
	// 		from the current ribbon, i.e. the current image is not present
	// 		in R (see next note for details).
	// NOTE: in before/after modes, if the target image is found then it
	// 		will be returned, thus the mode has no effect unless the 
	// 		target image is not loaded.
	// 		Use offset to explicitly get the image before/after target.
	//
	// NOTE: most of the complexity here comes from argument DSL parsing,
	// 		might be good to revise argument syntax and handling...
	//
	// XXX doc needs revision....
	getImage: function(target, mode, list){
		// empty data...
		if(this.order == null || (this.order && this.order.length == 0)){
			return null }
		// no args...
		if(target == null && mode == null && list == null){
			return this.current }

		target = target == 'current' ?
			this.current
			: target

		// explicit image gid -- get the loaded group gid...
		if(target in this.order_index){
			var x = this.getLoadedInGroup(target)
			target = x != null ? 
				x 
				: target }

		// first/last special case...
		// XXX need to get first loaded...
		if(target == 'first'){
			mode = mode == 'before' || mode == 'after' ? null : mode
			list = this.ribbons[this.getRibbon(mode)]
			for(var res in list){
				return list[res] }
			return null }
		if(target == 'last'){
			mode = mode == 'before' || mode == 'after' ? null : mode
			list = this.ribbons[this.getRibbon(mode)]
			for(var i=list.length; i >= 0; i--){
				if(list[i] != null){
					return list[i] } }
			return null }

		// normalize target...
		if(target in this.ribbons || target instanceof Array){
			list = target
			target = this.current

		} else if(['before', 'after', 'next', 'prev'].includes(target)){
			list = mode
			mode = target
			target = this.current }

		var offset = list == 'before' ? -1
			: list == 'after' ? 1 
			: 0
		if(list == 'before' || list == 'after'){
			list = null }

		// normalize mode...
		if(mode != null 
				&& mode instanceof Array
				|| mode in this.ribbons){
			list = mode
			mode = null }
		// relative mode and offset...
		if(typeof(mode) == typeof(123)){
			offset += mode
			mode = offset < 0 ? 'before'
				: offset > 0 ? 'after'
				: mode
			offset = Math.abs(offset)
		} else if(mode == 'global' || mode == 'loaded'){
			list = mode
			mode = 'before'
		} else if(mode == 'next'){
			offset = 1
		} else if(mode == 'prev'){
			offset = -1
		} else {
			var offset = 0 
			// NOTE: this will set the default mode to 'before' but only
			// 		when we are looking withing a specific set of images
			// 		...otherwise it will be left as is, i.e. strict mode.
			mode = (mode == null && list != null) ?
				'before' 
				: mode }

		// normalize the list to a sparse list of gids...
		list = list == null ? 
				this.ribbons[
					this.getRibbon(typeof(target) == typeof(123) ? undefined : target)
						// target exists but is not loaded...
						|| this.getRibbon() 
						// no current ribbon...
						|| this.getRibbon(this.getImage(target, 'before', this.getImages()))
						|| this.getRibbon(this.getImage(target, 'after', this.getImages()))]
			: list == 'global' ?
				this.order
			: list == 'loaded' ?
				this.getImages('loaded')
			: list instanceof Array ? 
				this.makeSparseImages(list)
			: this.ribbons[this.getRibbon(list)]

		// special case: nothing to chose from...
		if(list == null || list.length == 0){
			return null }

		// order -> gid special case...
		var i
		if(typeof(target) == typeof(123)){
			list = list.compact()
			if(target >= list.length){
				return null }
			i = target

		} else {
			i = this.order_index[target]

			// invalid gid...
			// XXX need a better way to report errors...
			if(i == -1){
				//return -1
				return undefined } }

		// normalize i...
		i = i >= 0 ? i : list.length+i

		var res = list[i]
		// we have a direct hit...
		if(res != null && offset == 0){
			return res }

		// prepare for the search...
		var step = (mode == 'before' || mode == 'prev') ? -1
			: (mode == 'after' || mode == 'next') ? 1
			: null

		// strict -- no hit means there is no point in searching...
		if(step == null){
			return null }

		// skip the current elem...
		i += step
		// get the first non-null, also accounting for offset...
		// NOTE: we are using this.order.length here as ribbons might 
		// 		be truncated...
		// XXX currently this works correctly ONLY when step and offset
		// 		are in the same direction...
		for(; i >= 0 && i < this.order.length; i+=step){
			var cur = list[i]
			// skip undefined or unloaded images...
			if(cur == null || this.getRibbon(cur) == null){
				continue }
			offset -= 1
			if(offset <= 0){
				return cur } }
		// target is either first or last...
		return null },	

	// Get image order...
	//
	// This is similar to .getImage(..) but adds an optional context.
	//
	// The context can be:
	//	'all' 		- global order (default)
	// 	'loaded'	- order in loaded images
	// 	'ribbon'	- order in ribbon
	//
	// NOTE: acquiring the gid is exactly the same as with .getImage(..)
	// 		next, that gid is used to get the order, in case of the 
	// 		'ribbon' context, the order is relative to the ribbon where
	// 		the image is located.
	// 		To get the order of an image in a different ribbon, get an 
	// 		appropriate before/after image in that ribbon and get it's 
	// 		order.
	getImageOrder: function(context, target, mode, list){
		if(context == 'loaded' || context == 'global'){
			return this.getImages('loaded').lastIndexOf(this.getImage(target, mode, list))

		} else if(context == 'ribbon'){
			var gid = this.getImage(target, mode, list)
			return this.getImages(gid).lastIndexOf(gid)

		} else if(context == 'all'){
			return this.order.lastIndexOf(this.getImage(target, mode, list)) } 

		return this.order.lastIndexOf(this.getImage(context, target, mode)) },	

	// Get a list of image gids...
	//
	//	Get list of loaded images:
	//	.getImages()
	//	.getImages('loaded')
	//		-> list
	//
	//	Get all images, both loaded and not:
	//	.getImages('all')
	//		-> list
	//
	//	Get list of images in current ribbon:
	//	.getImages('current')
	//		-> list
	//
	//	Filter the list and return only loaded images from it:
	//	.getImages(list)
	//	.getImages(list, 'loaded')
	//		-> list
	//
	//	Filter the list and return images present in data...
	//	.getImages(list, 'all')
	//	.getImages(list, 'global')
	//		-> list
	//
	//	Filter the list and return images in current ribbon only...
	//	.getImages(list, 'current')
	//		-> list
	//
	//	Filter the list and return images in specific ribbon only...
	//	.getImages(list, order|ribbon)
	//		-> list
	//
	//	Get loaded images from ribbon:
	//	.getImages(gid|order|ribbon)
	//		-> list 
	//
	//	Get count gids around (default) before or after the target image:
	//	.getImages(gid|order|ribbon, count)
	//	.getImages(gid|order|ribbon, count, 'around')
	//	.getImages(gid|order|ribbon, count, 'after')
	//	.getImages(gid|order|ribbon, count, 'before')
	//		-> list 
	//
	//	Get count images around target padding with available images:
	//	.getImages(gid|order|ribbon, count, 'total')
	//		NOTE: this is like 'around' above, but will always try to 
	//			return count images, e.g. when target is closer than 
	//			count/2 to start or end of ribbon, the resulting list 
	//			will get padded from the opposite side if available...
	//		-> list
	//
	// If no image is given the current image/ribbon is assumed as target.
	//
	// This will always return count images if there is enough images 
	// in ribbon from the requested sides of target.
	//
	// NOTE: this expects ribbon order and not image order.
	// NOTE: if count is even, it will return 1 more image to the left 
	// 		(before) the target.
	// NOTE: if the target is present in the image-set it will be included
	// 		in the result regardless of mode...
	// NOTE: to get a set of image around a specific (non-current) image
	// 		in a specific (non-current) ribbon first get an apropriate image
	// 		via. .getImage(..) and then get the list with this...
	// 			D.getImages(D.getImage(gid, ribbon_gid), N, 'around')
	//
	// XXX add group support -- get the loaded, either a group gid or 
	// 		one of the contained images (first?)
	// XXX for some reason negative target number (ribbon number) 
	// 		breaks this...
	//
	// NOTE: this is a partial rewrite avoiding .compact() as much as 
	// 		possible and restricting it to as small a subset as possible
	getImages: function(target, count, mode){
		var that = this
		target = (target == null && count == null) ? 'loaded' : target
		mode = mode == null ? 'around' : mode
		var list

		// normalize target and build the source list...

		// 'current' ribbon...
		target = target === 'current' ? this.current : target

		// get all gids...
		if(target === 'all'){
			list = this.order
			target = null

		// get loaded only gids...
		} else if(target === 'loaded'){
			list = this
				.mergeSparseImages(...Object.values(this.ribbons))
				.compact()
			target = null

		// filter out the unloaded gids from given list...
		} else if(target instanceof Array){
			var loaded = new Set(count == 'current' ? 
						this.getImages('current')
					: count == 'all' || count == 'global' ? 
						this.getImages('all')
					: count in this.ribbons ? 
						this.ribbons[count].compact()
					: typeof(count) == typeof(123) ? 
						this.ribbons[this.getRibbon(count)].compact()
					: this.getImages('loaded'))

			list = target
				.map(function(e){
					// primary path -- gids...
					// NOTE: this is the most probable path...
					if(loaded.has(e)){
						return e }

					// in case we are not dealing with a gid...
					// NOTE: this is a less likely path so it is secondary...
					e = count == 'all' || count == 'global' ?
						that.getImage(e, 'global')
						: that.getImage(e)

					return loaded.has(e) ? 
						e 
						: [] })
				.flat()

			count = null 
			target = null 

		// target is ribbon gid...
		} else if(target in this.ribbons){
			list = this.ribbons[target] }

		// NOTE: list can be null if we got an image gid or ribbon order...
		// get the ribbon gids...
		list = list 
			|| this.ribbons[this.getRibbon(target)] 
			|| []

		if(count == null){
			return list.compact() }

		target = this.getImage(target) 
			|| this.getImage(target, 'after')

		// prepare to slice the list...
		if(mode == 'around' || mode == 'total'){
			var pre = Math.floor(count/2)
			var post = Math.ceil(count/2) - 1

		} else if(mode == 'before'){
			var pre = count - 1 
			var post = 0 

		} else if(mode == 'after'){
			var pre = 0
			var post = count - 1

		} else {
			// XXX bad mode....
			return null }

		var res = [target]

		// XXX can we avoid .indexOf(..) here???
		//var i = list.indexOf(target)
		//var i = list.index(target)
		var i = list.lastIndexOf(target)
		// pre...
		for(var n = i-1; n >= 0 && pre > 0; n--){
			// NOTE: list may be sparse so we skip the items that are not
			// 		present and count only the ones we add...
			n in list
				&& res.push(list[n])
				&& pre-- }

		res.reverse()

		// post...
		// NOTE: this will also pad the tail if needed if mode is 'total'
		post = mode == 'total' ? post + pre : post
		for(var n = i+1; n < list.length && post > 0; n++){
			n in list
				&& res.push(list[n])
				&& post-- }

		// pad to total...
		// NOTE: we only need to pad the head here as the tail is padded
		// 		in the post section...
		if(mode == 'total' && post > 0){
			var pad = count - res.length
			//var i = list.indexOf(res[0])
			//var i = list.index(res[0])
			var i = list.lastIndexOf(res[0])

			res.reverse()
			for(var n = i-1; n >= 0 && pad > 0; n--){
				n in list
					&& res.push(list[n])
					&& pad-- }
			res.reverse() }

		return res },

	// Get image positions...
	//
	// 	Get current image position...
	// 	.getImagePositions()
	// 		-> positions
	//
	// 	Get positions of gid(s)...
	// 	.getImagePositions(gid)
	// 	.getImagePositions(gid, ...)
	// 	.getImagePositions([gid, ...])
	// 		-> positions
	//
	// The resulting positions will be sorted to .order, ribbon gids 
	// are pushed to the end of the list and also sorted to .ribbon_order
	//
	// Returns:
	// 	[
	// 		[<image-gid>, 
	// 			[<ribbon-gid>, <ribbon-order>]], 
	// 			<image-order>],
	// 		...
	// 	]
	//
	// NOTE: if a ribbon gid is encountered it will be expanded to a 
	// 		list of image gids...
	getImagePositions: function(gids){
		gids = arguments.length > 1 ? 
			[...arguments] 
			: (gids || this.current)
		gids = (gids instanceof Array ? gids.slice() : [gids])
		// sort ribbon gids to .ribbon_order
		gids = gids
			.concat(this.ribbon_order
				.filter(function(g){ 
					var i = gids.indexOf(g)
					return i >= 0 ? 
						!!gids.splice(i, 1) 
						: false }))
		return this
			// sort list...
			// NOTE: ribbon gids will get pushed to the end...
			.makeSparseImages(gids)
			.map(function(g){ return [ 
				// get the images...
				this.ribbons[g] ? 
					this.getImages(g) 
					: g, 
				// get ribbon and ribbon order...
				[ this.getRibbon(g), this.getRibbonOrder(g) ],
				// global order...
				this.order.indexOf(g),
			] }.bind(this))
			// XXX do we need this???
			// 		...removing this would also encode order...
			.compact() },

	// Get ribbon...
	// 
	//	Get current ribbon:
	//	.getRibbon()
	//	.getRibbon('current')
	//		-> ribbon gid
	//
	//	Get first/last ribbon:
	//	.getRibbon('first')
	//	.getRibbon('last')
	//		-> ribbon gid
	//
	//	Get base ribbon:
	//	.getRibbon('base')
	//		-> base ribbon gid
	//
	//	Get ribbon before/after current 
	//	.getRibbon('before')
	//	.getRibbon('prev')
	//	.getRibbon('after')
	//	.getRibbon('next')
	//		-> gid
	//		-> null
	//
	//	Get ribbon by target image/ribbon:
	//	.getRibbon(ribbon|order|gid)
	//		-> ribbon gid
	//		-> null -- invalid target
	//		NOTE: if ribbon gid is given this will return it as-is.
	//
	//	Get ribbon before/after target:
	//	.getRibbon(ribbon|order|gid, 'before')
	//	.getRibbon(ribbon|order|gid, 'after')
	//		-> ribbon gid
	//		-> null -- invalid target
	//
	//	Get ribbon at offset from target:
	//	.getRibbon(ribbon|order|gid, offset)
	//		-> ribbon gid
	//		-> null -- invalid target
	//
	//
	// NOTE: this expects ribbon order and not image order.
	// NOTE: negative ribbon order is relative to list tail.
	//
	// XXX add group support -- get the loaded, either a group gid or 
	// 		one of the contained images (first?)
	getRibbon: function(target, offset){
		target = target == null ? this.current : target

		if(target == 'first'){
			return this.ribbon_order[0]

		} else if(target == 'last'){
			return this.ribbon_order.slice(-1)[0] }

		target = target == 'next' || target == 'below' ? 'after' : target
		target = target == 'prev' || target == 'above' ? 'before' : target

		if(target == 'before' || target == 'after'){
			offset = target
			target = 'current' }

		offset = offset == null ? 0 : offset
		offset = offset == 'before' ? -1 : offset
		offset = offset == 'after' ? 1 : offset

		// special keywords...
		if(target == 'base'){
			return this.base

		} else if(target == 'current'){
			target = this.current }

		var ribbons = this.ribbons
		var o

		// we got a ribbon gid...
		if(target in ribbons){
			o = this.ribbon_order.indexOf(target)

		// we got a ribbon order...
		} else if(typeof(target) == typeof(123)){
			o = target

		// image gid...
		} else {
			// get the loaded group gid...
			var x = this.getLoadedInGroup(target)
			target = x != null ? x : target

			var i = this.order_index[target]
			if(i == -1){
				return null
			}
			var k
			for(k in ribbons){
				if(ribbons[k][i] != null){
					o = this.ribbon_order.indexOf(k)
					break } } }

		if(o != null){
			// negative indexes are relative to list tail...
			o = o < 0 ? o + this.ribbon_order.length : o

			o += offset


			if(o < 0 || o > this.ribbon_order.length){
				// ERROR: offset out of bounds...
				return null }
			return this.ribbon_order[o] }

		// ERROR: invalid target...
		return null },
	// same as .getRibbon(..) but returns ribbon order...
	getRibbonOrder: function(target, offset){
		return this.ribbon_order.indexOf(this.getRibbon(target, offset)) },



	/******************************************************** Edit ***/

	// Focus an image -- make it current...
	//
	// This is signature compatible with .getImage(..), see it for more
	// info...
	focusImage: function(target, mode, list){
		var current = this.getImage(target, mode, list)
		// in case no args are given other than target...
		if(target && current == null && mode == null && list == null){
			current = this.getImage(target, 'after')
		}
		if(this.order_index[current] >= 0){
			this.__current = current
		}
		return this },	

	// Focus a ribbon -- focus an image in that ribbon
	//
	// NOTE: target must be .getRibbon(..) compatible.
	focusRibbon: function(target){
		var cur = this.getRibbonOrder()
		var ribbon = this.getRibbon(target)

		// nothing to do...
		if(target == null || ribbon == null){
			return this }

		var t = this.getRibbonOrder(ribbon)

		// XXX revise this...
		var direction = t < cur ? 'before' : 'after'

		var img = this.getImage(ribbon, direction)

		// first/last image...
		if(img == null){
			img = direction == 'before' 
				? this.getImage('first', ribbon) 
				: this.getImage('last', ribbon) }

		return this.focusImage(img) },


	// Shorthand methods...
	//
	// XXX should these be here???
	focusBaseRibbon: function(){ return this.focusImage(this.base) },
	focusImageOffset: function(offset){
		offset = offset == null ? 0 : offset

		var min = -this.getImageOrder('ribbon')
		var max = this.getImages('current').length-1

		offset = Math.max(min, Math.min(max, offset))

		return this.focusImage('current', offset) },
	nextImage: function(){ return this.focusImageOffset(1) }, // Gen2
	prevImage: function(){ return this.focusImageOffset(-1) }, // Gen2
	firstImage: function(){ return this.focusImage('first') }, // Gen2
	lastImage: function(){ return this.focusImage('last') }, // Gen2
	focusRibbonOffset: function(offset){
		var c = this.getRibbonOrder()
		var t = c+offset
		t = Math.max(0, Math.min(this.ribbon_order.length-1, t))

		// NOTE: the modes here are different for directions to balance
		// 		up/down navigation...
		return this.focusImage('current', (t < c ? 'after' : 'before'), t) },
	nextRibbon: function(){ return this.focusRibbonOffset(1) }, // Gen2
	prevRibbon: function(){ return this.focusRibbonOffset(-1) }, // Gen2

	// Set base ribbon...
	//
	// This is signature compatible with .getRibbon(..), see it for more
	// info...
	setBase: function(target, offset){
		this.base = this.getRibbon(target, offset)
		return this },

	// Create empty ribbon...
	//
	// If mode is 'below' this will create a new ribbon below the target,
	// otherwise the new ribbon will be created above.
	newRibbon: function(target, mode){
		var gid = this.newGID()
		var i = this.getRibbonOrder(target)

		i = mode == 'below' ? i+1 : i

		this.ribbon_order.splice(i, 0, gid)
		this.ribbons[gid] = []

		return gid },

	// Merge ribbons
	//
	//	Merge all the ribbons...
	//	.mergeRibbons('all')
	//
	//	Merge ribbons...
	//	.mergeRibbons(ribbon, ribbon, ...)
	//		-> data
	//
	// This will merge the ribbons into the first.
	//
	mergeRibbons: function(target){
		var targets = target == 'all' ? 
			this.ribbon_order.slice() 
			: arguments
		var base = targets[0]

		for(var i=1; i < targets.length; i++){
			var r = targets[i]
			this.makeSparseImages(this.ribbons[r], this.ribbons[base])

			delete this.ribbons[r]
			this.ribbon_order.splice(this.ribbon_order.indexOf(r), 1) }

		// update .base if that gid got merged in...
		this.ribbon_order.indexOf(this.base) < 0
			&& (this.base = base)

		return this },

	// Update image position via .order...
	//
	//	Full sort
	//	.updateImagePositions()
	//		-> data
	//
	//	Full sort and remove items not in .order
	//	.updateImagePositions('remove')
	//		-> data
	//
	//	Reposition specific item(s)...
	//	.updateImagePositions(gid|index)
	//	.updateImagePositions([gid|index, .. ])
	//		-> data
	//
	//	Reposition item(s) and the item(s) they replace...
	//	.updateImagePositions(gid|index, 'keep')
	//	.updateImagePositions([gid|index, ..], 'keep')
	//		-> data
	//
	//	Hide item(s) from lists...
	//	.updateImagePositions(gid|index, 'hide')
	//	.updateImagePositions([gid|index, ..], 'hide')
	//		-> data
	//
	//	Remove item(s) from lists...
	//	.updateImagePositions(gid|index, 'remove')
	//	.updateImagePositions([gid|index, ..], 'remove')
	//		-> data
	//
	//
	// NOTE: hide will not change the order of other items while remove 
	// 		will do a full sort...
	// NOTE: in any case other that the first this will not try to 
	// 		correct any errors.
	//
	// XXX needs more thought....
	// 		do we need to move images by this???
	updateImagePositions: function(from, mode, direction){
		if(['keep', 'hide', 'remove'].indexOf(from) >= 0){
			mode = from
			from = null }
		from = from == null || from instanceof Array ? from : [from]

		var r = this.getRibbon('current')

		// XXX EXPERIMENTAL: order_index
		// XXX should this be optional???
		delete this.__order_index

		this.eachImageList(function(cur, key, set){
			set = this[set]

			// resort...
			if(from == null){
				set[key] = mode == 'remove' ? 
					this.makeSparseImages(cur, true)
					: this.makeSparseImages(cur)

			// remove/hide elements...
			} else if(mode == 'remove' || mode == 'hide'){
				from.forEach(function(g){
					delete cur[cur.indexOf(g)] })
				// if we are removing we'll also need to resort...
				mode == 'remove'
					&& (set[key] = this.makeSparseImages(cur, true))

			// place and keep existing...
			} else if(mode == 'keep'){
				set[key] = this.makeSparseImages(from, cur, true)

			// only place...
			} else {
				set[key] = this.makeSparseImages(from, cur) } })

		// maintain focus...
		from 
			&& from.includes(this.current)
			&& this.focusImage(r)

		return this },

	// Reverse .order and all the ribbons...
	//
	// NOTE: this sorts in-place
	//
	// NOTE: this depends on setting length of an array, it works in 
	// 		Chrome but will it work the same in other systems???
	reverseImages: function(){
		var order = this.order
		order.reverse()
		// XXX EXPERIMENTAL: order_index
		delete this.__order_index
		var l = order.length

		var that = this
		this.eachImageList(function(lst){
			lst.length = l
			lst.reverse() })
		return this },

	// Sort images in ribbons via .order...
	//
	// NOTE: this sorts in-place
	// NOTE: this will not change image order
	sortImages: function(cmp){
		// sort the order...
		this.order.sort(cmp)
		
		return this.updateImagePositions() },

	reverseRibbons: function(){
		this.ribbon_order.reverse() },


	// Place image at position... 
	//
	//	Place images at order into ribbon...
	//	.placeImage(images, ribbon, order)
	//		-> data
	//
	//	As above but add before/after order...
	//	.placeImage(images, ribbon, order, 'before')
	//	.placeImage(images, ribbon, order, 'after')
	//		-> data
	//
	//	Place images at order but do not touch ribbon position... (horizontal)
	//	.placeImage(images, 'keep', order)
	//		-> data
	//
	//	As above but add before/after order...
	//	.placeImage(images, 'keep', order, 'before')
	//	.placeImage(images, 'keep', order, 'after')
	//		-> data
	//
	//	Place images to ribbon but do not touch order... (vertical)
	//	.placeImage(images, ribbon, 'keep')
	//		-> data
	//
	// images is .getImage(..) compatible or a list of compatibles.
	// ribbon is:
	// 		- .getRibbon(..) compatible or 'keep'
	// 		- a new ribbon gid (appended to .ribbon_order)
	// 		- [gid, order] where gid will be placed at order in .ribbon_order
	// 			NOTE: order is only used if ribbon is not present in .ribbon_order
	// order is .getImageOrder(..) compatible or 'keep'.
	//
	// This will not change the relative order of input images unless 
	// (special case) the target image is in the images.
	//
	//
	// NOTE: if images is a list, all images will be placed in the order
	// 		they are given.
	// NOTE: this can affect element indexes, thus for example element 
	// 		at input order may be at a different position after this is 
	// 		run.
	// NOTE: this will clear empty ribbons. This can happen when the input
	// 		images contain all of the images of one or more ribbons...
	placeImage: function(images, ribbon, reference, mode){
		var that = this
		mode = mode || 'before'

		// XXX how do we complain and fail here??
		if(mode != 'before' && mode != 'after'){
			console.error('invalid mode:', mode)
			return this }

		images = this.normalizeGIDs(images)

		// vertical shift -- gather images to the target ribbon...
		if(ribbon != 'keep'){
			// handle [ribbon, order] format...
			var i = ribbon instanceof Array ? ribbon[1] : null
			ribbon = ribbon instanceof Array ? ribbon[0] : ribbon

			var to = this.getRibbon(ribbon)

			// create ribbon...
			if(to == null){
				to = ribbon
				this.ribbons[to] = []
				i == null ? 
					this.ribbon_order.push(to)
					: this.ribbon_order.splice(i, 0, to) }

			this.makeSparseImages(images)
				.forEach(function(img, f){
					var from = that.getRibbon(img)
					if(from != to){
						that.ribbons[to][f] = img
						delete that.ribbons[from][f] } })
			this.clear('empty') }
		
		// horizontal shift -- gather the images horizontally...
		if(reference != 'keep'){
			var ref = this.getImage(reference)
			var order = this.order

			// NOTE: the reference index will not move as nothing will 
			// 		ever change it's position relative to it...
			var ri = order.indexOf(ref)
			var l = ri

			images
				.forEach(function(gid){
					if(gid == ref){
						return }

					// we need to get this live as we are moving images around...
					var f = order.indexOf(gid)

					// target is left of the reference -- place at reference...
					// NOTE: we are moving left to right, thus the final order
					// 		of images will stay the same.
					if(f < ri){
						var i = mode == 'after' ? l : ri-1
						order.splice(i, 0, order.splice(f, 1)[0])

					// target is right of the reference -- place each new image
					// at an offset from reference, the offset is equal to 
					// the number of the target image the right of the reference
					} else {
						if(mode == 'before'){
							order.splice(l, 0, order.splice(f, 1)[0])
							l += 1

						} else {
							l += 1
							order.splice(l, 0, order.splice(f, 1)[0]) } } })

			this.updateImagePositions() }

		return this },

	// Shift image...
	//
	//	Shift image(s) to after target position:
	//	.shiftImage(from, gid|order|ribbon)
	//	.shiftImage(from, gid|order|ribbon, 'after')
	//
	//	Shift image(s) to before target position:
	//	.shiftImage(from, gid|order|ribbon, 'before')
	//		-> this
	//
	//	Shift vertically only -- keep image order...
	//	.shiftImage(from, gid|order|ribbon, 'vertical')
	//
	//	Shift horizontally only -- keep image(s) in same ribbons...
	//	.shiftImage(from, gid|order|ribbon, 'horizontal')
	//
	//
	//	Shift image(s) by offset:
	//	.shiftImage(from, offset, 'offset')
	//		-> this
	//
	//
	// order is expected to be ribbon order.
	//
	// from must be one of:
	// 	- a .getImage(..) compatible object. usually an image gid, order,
	// 	  or null, see .getImage(..) for more info.
	// 	- a list of .getImage(..) compatible objects.
	//
	// When shifting a set of gids horizontally this will pack them 
	// together in order.
	//
	//
	// NOTE: this will not create new ribbons.
	// NOTE: this is a different interface to .placeImage(..)
	//
	// XXX should we use .placeImage(..) instead???
	shiftImage: function(from, target, mode){
		from = from == null || from == 'current' ? this.current : from
		if(from == null){
			return }
		from = from instanceof Array ? from : [from]

		// target is an offset...
		if(mode == 'offset'){
			if(target > 0){
				var t = this.getImage(from.slice(-1)[0], target)
					|| this.getImage('last', from.slice(-1)[0])
				var direction = from.indexOf(t) >= 0 ? null : 'after'

			} else {
				var t = this.getImage(from[0], target) 
					|| this.getImage('first', from[0])
				var direction = from.indexOf(t) >= 0 ? null : 'before' }

		// target is ribbon index...
		} else if(typeof(target) == typeof(123)){
			var t = this.getImage(this.getRibbon(target))
				// in case of an empty ribbon...
				|| this.getRibbon(target)
			var direction = mode == 'before' || mode == 'after' ? mode : 'after'

		// target is an image...
		} else {
			var t = this.getImage(target)
			var direction = mode == 'before' || mode == 'after' ? mode : 'after' }

		return this.placeImage(
			from, 
			mode == 'horizontal' ? 'keep' : t, 
			mode == 'vertical' ? 'keep' : t, 
			direction) },

	// Shorthand actions...
	//
	// NOTE: none of these change .current
	shiftImageLeft: function(gid){ return this.shiftImage(gid, -1, 'offset') },
	shiftImageRight: function(gid){ return this.shiftImage(gid, 1, 'offset') },
	// NOTE: these will not affect ribbon order.
	// NOTE: these will create new ribbons when shifting from first/last
	// 		ribbons respectively.
	// NOTE: these will remove an empty ribbon after shifting the last 
	// 		image out...
	// NOTE: if base ribbon is removed this will try and reset it to the
	// 		ribbon above or the top ribbon...
	shiftImageUp: function(gid){ 
		gid = gid || this.current
		var g = gid && gid instanceof Array ? gid[0] : gid
		var r = this.getRibbonOrder(g)
		// check if we need to create a ribbon here...
		if(r == 0){
			r += 1
			this.newRibbon(g) }
		var res = this.shiftImage(gid, r-1, 'vertical') 
		if(res == null){
			return }
		return res },
	shiftImageDown: function(gid){ 
		gid = gid || this.current
		var g = gid && gid instanceof Array ? gid[0] : gid
		var r = this.getRibbonOrder(g)
		// check if we need to create a ribbon here...
		r == this.ribbon_order.length-1
			&& this.newRibbon(g, 'below')
		var res = this.shiftImage(gid, r+1, 'vertical') 
		if(res == null){
			return }
		return res },

	// Shift ribbon vertically...
	//
	// 	Shift ribbon to position...
	// 	.shiftRibbon(gid, gid)
	// 	.shiftRibbon(gid, gid, 'before')
	// 	.shiftRibbon(gid, gid, 'after')
	// 		-> data
	// 		NOTE: 'before' is default.
	//
	// 	Shift ribbon by offset...
	// 	.shiftRibbon(gid, offset, 'offset')
	// 		-> data
	//
	// XXX test...
	shiftRibbon: function(gid, to, mode){
		var i = this.getRibbonOrder(gid)

		// to is an offset...
		if(mode == 'offset'){
			to = i + to

		// to is a gid...
		} else {
			to = this.getRibbonOrder(to)
			mode == 'after'
				&& (to += 1) }

		// normalize to...
		to = Math.max(0, Math.min(this.ribbon_order.length-1, to))

		this.ribbon_order.splice(to, 0, this.ribbon_order.splice(i, 1)[0])

		return this },

	// Shorthand actions...
	//
	// XXX should these be here??
	shiftRibbonUp: function(gid){ return this.shiftRibbon(gid, -1, 'offset') },
	shiftRibbonDown: function(gid){ return this.shiftRibbon(gid, 1, 'offset') },


	/****************************************************** Groups ***/
	// A group is a small set of images...
	//
	// All images in a group are in ONE ribbon but can be at any location
	// in order.
	//
	// It can be in one of two states:
	// 	- collapsed
	// 		- group images are not loaded
	// 		- group cover is loaded
	// 	- expanded
	// 		- group cover is not loaded
	// 		- group images are loaded
	//
	// XXX group cover -- which image and should this question be asked
	// 		on this level???
	//
	// XXX experimental...
	// 		...not sure if storing groups in .groups here is the right 
	// 		way to go...
	// XXX need to set default cover... (???)
	// XXX should these be here or in a separate class???
	
	// Test if a gid is a group gid...
	//
	isGroup: function(gid){
		gid = gid == null ? this.getImage() : gid
		return this.groups != null ? 
			gid in this.groups 
			: false },

	// Get a group gid...
	//
	// This will check if the given gid is contained in a group and 
	// return the group's gid or null if the image is ungrouped.
	//
	getGroup: function(gid){
		gid = gid == null ? this.getImage() : gid
		if(this.isGroup(gid)){
			return gid }
		if(this.groups == null){
			return null }

		for(var k in this.groups){
			if(this.groups[k].indexOf(gid) >= 0){
				return k } }

		return null },

	// Get loaded gid representing a group...
	//
	// This will either be a group gid if collapsed or first loaded gid
	// from within if group expanded...
	//
	// NOTE: this will get the first loaded image of a group regardless
	// 		of group/image gid given...
	// 		Thus, this will return the argument ONLY if it is loaded.
	// NOTE: this does not account for current position in selecting an
	// 		image from the group...
	getLoadedInGroup: function(gid){
		var group = this.getGroup(gid)

		// not a group...
		if(group == null){
			return null }

		// get the actual image gid...
		var gids = gid == group ? this.groups[group] : [gid]

		// find either
		for(var k in this.ribbons){
			if(this.ribbons[k].indexOf(group) >= 0){
				return group }
			// get the first loaded gid in group...
			for(var i=0; i<gids.length; i++){
				if(this.ribbons[k].indexOf(gids[i]) >= 0){
					return gids[i] } } }

		// nothing loaded...
		return null },

	// Group image(s)...
	//
	// 	Group image(s) into a new group
	// 	.group(image(s))
	// 		-> data
	//
	// 	Group image(s) into a specific group, creating one if needed
	// 	.group(image(s), group)
	// 		-> data
	//
	// NOTE: image(s) can be either a single image gid or a list of gids.
	// NOTE: group intersections are not allowed, i.e. images can not 
	// 		belong to two groups.
	// NOTE: nesting groups is supported. (XXX test)
	//
	// XXX test if generated gid is unique...
	group: function(gids, group){
		gids = gids == null ? this.getImage() : gids
		gids = gids instanceof Array ? gids : [gids]
		// XXX not safe -- fast enough and one can generate two identical
		// 		gids...
		group = group == null ? this.newGID('G' + Date.now()) : group

		this.groups = this.groups || {}

		// take only images that are not part of a group...
		if(this.__group_index !== false){
			var that = this
			var index = this.__group_index || []
			Object.keys(this.groups).forEach(function(k){ 
				that.makeSparseImages(that.groups[k], index) })
			gids = gids.filter(function(g){ return index.indexOf(g) < 0 })
			// update the index...
			this.__group_index = this.makeSparseImages(gids, index) }

		// no images no group...
		// XXX should we complain??
		if(gids.length == 0){
			return this }

		// existing group...
		if(group in this.groups){
			var lst = this.makeSparseImages(this.groups[group])
			var place = false

		// new group...
		} else {
			var lst = []
			var place = true }

		this.groups[group] = this.makeSparseImages(gids, lst)

		// when adding to a new group, collapse only if group is collapsed...
		if(this.getRibbon(group) != null){
			this.collapseGroup(group) }

		return this },

	// Ungroup grouped images
	//
	// The containing group will be removed placing the images in the 
	// ribbon where the group resided.
	//
	ungroup: function(group){
		group = this.getGroup(group)

		if(group == null){
			return this }

		this.expandGroup(group)

		// cleanup the index if it exists...
		if(this.__group_index){
			var index = this.__group_index
			this.groups[group].forEach(function(g){
				delete index[index.indexOf(g)] }) }

		// remove the group...
		delete this.groups[group]
		this.clear(group)

		return this },

	// Expand a group...
	//
	// This will show the group images and hide group cover.
	//
	expandGroup: function(groups){
		var that = this
		groups = groups == null ? 
				this.getGroup()
			: groups == 'all' || groups == '*' ? 
				Object.keys(this.groups)
			: groups
		groups = groups instanceof Array ? groups : [groups]

		groups
			.forEach(function(group){
				group = that.getGroup(group)
				
				if(group == null){
					return }

				var lst = that.groups[group]
				var r = that.getRibbon(group)

				// already expanded...
				if(r == null){
					return }

				// place images...
				lst.forEach(function(gid, i){
					that.ribbons[r][i] = gid })

				that.current == group
					&& (that.current = lst.compact()[0])

				// hide group...
				delete that.ribbons[r][that.order.indexOf(group)] })

		return this },

	// Collapse a group...
	//
	// This is the opposite of expand, showing the cover and hiding the
	// contained images.
	//
	// NOTE: if group gid is not present in .order it will be added and 
	// 		all data sets will be updated accordingly...
	collapseGroup: function(groups, safe){
		var that = this
		groups = groups == null ? 
				this.getGroup() 
			: groups == 'all' || groups == '*' ? 
				Object.keys(this.groups)
			: groups
		groups = groups instanceof Array ? groups : [groups]
		safe = safe || false

		groups
			.forEach(function(group){
				group = that.getGroup(group)
				
				if(group == null){
					return }

				var lst = that.groups[group]

				if(lst.len == 0){
					return }

				var r = that.getRibbon(group)
				r = r == null ? 
					that.getRibbon(that.groups[group].compact()[0]) 
					: r

				// if group is not in olace place it...
				var g = that.order.indexOf(group)
				if(g == -1){
					g = that.order.indexOf(that.groups[group].compact(0)[0])

					// update order...
					that.order.splice(g, 0, group)

					if(safe){
						that.updateImagePositions()

					// NOTE: if the data is not consistent, this might be 
					// 		destructive, but this is faster...
					} else {
						// update lists...
						that.eachImageList(function(lst){
							// insert a place for the group...
							lst.splice(g, 0, undefined)
							delete lst[g] }) } }

				// remove grouped images from ribbons...
				lst.forEach(function(gid, i){
					Object.keys(that.ribbons).forEach(function(r){
						delete that.ribbons[r][i] }) })

				// insert group...
				that.ribbons[r][that.order.indexOf(group)] = group

				// shift current...
				lst.includes(that.current)
					&& (that.current = group) })

		return this },

	// Croup current group...
	//
	cropGroup: function(target){
		var target = this.getImage(target)
		var group = this.getGroup(target)
		
		// not a group...
		if(group == null){
			return }

		// group is expanded -- all the images we need are loaded...
		if(target != group){
			var res = this.crop(this.groups[group])

		// group collapsed -- need to get the elements manually...
		} else {
			var r = this.getRibbon(target)
			var res = this.crop(this.groups[group])
			res.ribbon_order = [r]
			res.ribbons[r] = this.groups[group].slice()
			res.focusImage(this.current, 'before', r) }
		
		return res },



	/********************************************* Data-level edit ***/

	// Split data into sections...
	//
	// 	.split(target, ..)
	// 	.split([target, ..])
	// 		-> list
	//
	//
	// This will "split" the data just before each target, i.e. target N
	// will get the head of N+1 section.
	//
	// 		 Data							 Data		 Data
	// 		[...oooooXooooo...]		->		[...ooooo]	[Xooooo...]
	// 				 ^									 ^
	// 			  target							  target
	//
	//
	// Special case: target is .order.length
	// This will indicate that the last data section will be empty.
	//
	// 		 Data							 Data		 		 Data
	// 		[...oooooooooooo]		->		[...oooooooooooo]	[]
	// 						^								^
	//					 target							 target
	//
	//
	// Targets MUST be listed in order of occurrence.
	//
	// Returns list of split sections.
	//
	// NOTE: this will not affect the original data object...
	// NOTE: this might result in empty ribbons, if no images are in a 
	// 		given ribbon in the section to be split...
	// NOTE: target must be a .getImage(..) compatible value, for 
	// 		differences see next note.
	// NOTE: if target is a number then it is treated as global index, 
	// 		similar to .getImageOrder(..) default but different form
	// 		.getImage(..)
	// NOTE: if no target is given this will assume the current image.
	split: function(target){
		target = arguments.length > 1 ? [...arguments]
			: target == null || target instanceof Array ? target
			: [target]

		var res = []
		var tail = this.clone()
		var that = this

		// NOTE: we modify tail here on each iteration...
		target
			.forEach(function(i){
				i = i >= that.order.length ? 
						tail.order.length
					: typeof(i) == typeof(123) ? 
						tail.getImageOrder(that.getImage(i, 'global'))
					: tail.getImageOrder(that.getImage(i))
				var n = new Data()
				n.base = tail.base
				n.ribbon_order = tail.ribbon_order.slice()
				n.order = tail.order.splice(0, i)
				tail
					.eachImageList(function(lst, key, set){
						n[set] = n[set] || {}
						n[set][key] = lst.splice(0, i) })
				n.current = n.order.indexOf(tail.current) >= 0 ? 
					tail.current 
					: n.order[0]
				n.order_index = n.order.toKeys()
				
				res.push(n) })

		// update .current of the last element...
		tail.current = tail.order.indexOf(tail.current) >= 0 ? 
			tail.current 
			: tail.order[0]

		res.push(tail)
		return res },

	// Join data objects into the current object...
	//
	//	.join(data, ..)
	//	.join([ data, .. ])
	//		-> data with all the other data objects merged in, aligned 
	//			via base ribbon.
	//
	//	.join(align, data, ..)
	//	.join(align, [ data, .. ])
	//		-> data with all the other data objects merged in, via align
	//
	//
	// align can be:
	// 	'base'		- base ribbons (default)
	// 	'top'		- top ribbons
	// 	'bottom'	- bottom ribbons
	//
	// NOTE: data can be both a list of arguments or an array.
	// NOTE: this will merge the items in-place, into the method's object;
	// 		if it is needed to keep the original intact, just .clone() it...
	//
	// XXX add a 'gid' align mode... (???)
	// 		...or should this be a .merge(..) action???
	// XXX do we need to take care of gid conflicts between merged data sets???
	// 		...now images with matching gids will simply be overwritten.
	join: function(...args){
		var align = typeof(args[0]) == typeof('str') || args[0] == null ? 
			args.shift() 
			: 'base'
		align = align || 'base'
		args = args[0] instanceof Array ? args[0] : args

		var base = this

		args
			.forEach(function(data){
				// calculate align offset...
				// NOTE: negative d means we push data up while positive 
				// 		pushes data down by number of ribbons...
				if(align == 'base'){
					var d = base.getRibbonOrder('base') - data.getRibbonOrder('base')

				} else if(align == 'top'){
					var d = 0

				} else if(align == 'bottom'){
					var d = base.ribbon_order.length - data.ribbon_order.length }

				// merge order...
				// XXX need to take care of gid conflicts... (???)
				base.order = base.order.concat(data.order)
				base.order_index = base.order.toKeys()

				// merge .ribbons and .ribbon_order...
				// NOTE: this is a special case, so we do not handle it in 
				// 		the .eachImageList(..) below. the reason being that
				// 		ribbons can be merged in different ways.
				// NOTE: we will reuse gids of ribbons that did not change...
				var n_base = d > 0 ? 
					base.getRibbonOrder('base') 
					: data.getRibbonOrder('base')
				var cur = base.current

				var i = 0
				var n_ribbons = {}
				var n_ribbon_order = []
				var b_ribbon_order = base.ribbon_order.slice()
				var d_ribbon_order = data.ribbon_order.slice()
				while(b_ribbon_order.length > 0 
						|| d_ribbon_order.length > 0){
					// pull data up by d...
					if(d + i < 0){
						var bg = null
						var dg = d_ribbon_order.shift()
						var gid = dg

					// push data down by d...
					} else if(d - i > 0){
						var bg = b_ribbon_order.shift()
						var dg = null
						var gid = bg

					// merge...
					} else {
						var bg = b_ribbon_order.shift()
						var dg = d_ribbon_order.shift()
						var gid = base.newGID() }

					// do the actual merge...
					//
					// NOTE: the tails will take care of themselves here...
					n_ribbons[gid] = 
						(base.ribbons[bg] || [])
							.concat(data.ribbons[dg] || [])
					n_ribbon_order.push(gid)
					i++ }

				// set the new data...
				base.ribbon_order = n_ribbon_order
				base.ribbons = n_ribbons
				base.base = base.getRibbon(n_base)
				base.current = cur

				// merge other stuff...
				data
					.eachImageList(function(list, key, set){
						if(set == 'ribbons'){
							return }

						var s = base[set] = base[set] || {}

						if(s[key] == null){
							base[set][key] = base.makeSparseImages(list)

						} else {
							s[key] = base.makeSparseImages(s[key].concat(list)) } }) })

		base
			// XXX this is slow-ish...
			//.removeDuplicateGIDs()
			.clear('duplicates')
			.clear('empty')

		return base },

	// Align data to ribbon...
	//
	// NOTE: if either start or end is not given this will infer the 
	// 		missing values via the ribbon above.
	// NOTE: if either start or end is not given this can only align 
	// 		downward, needing a ribbon above the target to infer the 
	// 		values.
	//
	// XXX test...
	alignToRibbon: function(ribbon, start, end){
		ribbon = ribbon == null ? this.base : this.getRibbon(ribbon)

		if(start == null || end == null){
			var r = this.getRibbonOrder(ribbon)
			// ribbon is top ribbon, nothing to do...
			if(r <= 0){
				return this }

			var above = this.getRibbon(r-1) }

		var that = this
		// get the edge (left/right-most image) of the set of ribbons 
		// above the above ribbon calculated above... (no pun intended)
		var _getEdge = function(side){
			return Math[side == 'left' ? 'min' : 'max'].apply(null, 
				that.ribbon_order
					.map(function(ribbon, i){ 
						return i > r-1 
							?  null
							: that.getImageOrder(
								side == 'left' ? 'first' : 'last', 
								ribbon) })
					// cleanup...
					.filter(function(i){ 
						return i != null })) }

		start = start == null 
			//? this.getImageOrder('first', above)
			? _getEdge('left') 
			: this.getImageOrder(start)
		end = end == null 
			// NOTE: we need to exclude the last image in ribbon from 
			// 		the next section, this the offset.
			//? this.getImageOrder('last', above)+1
			? _getEdge('right')+1
			: this.getImageOrder(end)

		// split the data into three sections...
		var res = this.split(start, end)

		// cleanup...
		// XXX do we actually need this???
		res.forEach(function(e){ return e.clear('empty') })

		// set the base ribbon on the middle section...
		res[1].setBase(0)

		// remove empty sections...
		res = res.filter(function(e){ return e.length > 0 })

		// join the resulting data to the base ribbon...
		// NOTE: if we have only one non-empty section then nothing needs
		// 		to be done...
		res.length > 1
			&& (res = res[0].join(res.slice(1)))

		// transfer data to new data object...
		res.current = this.current
		res.base = this.base

		return res },

	// Crop the data...
	//
	// NOTE: this will not affect the original data object...
	// NOTE: this will not crop the .order...
	crop: function(list, flatten){
		var crop = this.clone()
		list = list == null || list == '*' ? 
			'*' 
			: crop.makeSparseImages(list)

		if(!flatten){
			if(list == '*'){
				return crop }
			// place images in ribbons...
			for(var k in crop.ribbons){
				crop.ribbons[k] = crop.makeSparseImages(
						crop.ribbons[k]
							.filter(function(_, i){ return list[i] != null })) }

		// flatten the crop...
		} else {
			list = list == '*' ? 
				crop.makeSparseImages(
					crop.ribbon_order
						.map(function(r){ return crop.ribbons[r] })
						.reduce(function(a, b){ return a.concat(b) }, []))
				: list
			crop.ribbons = {}
			crop.ribbon_order = []
			crop.ribbons[crop.newRibbon()] = list }

		// clear empty ribbons...
		crop.clear('empty')

		// set the current image in the crop...
		var r = this.getRibbon()
		// if current ribbon is not empty get the closest image in it...
		if(r in crop.ribbons && crop.ribbons[r].length > 0){
			// XXX is this the correct way to do this???
			// 		...should we use direction???
			var target = crop.getImage(this.current, 'after', this.getRibbon())
				|| crop.getImage(this.current, 'before', this.getRibbon())

		// if ribbon got deleted, get the closest loaded image...
		} else {
			// XXX is this the correct way to do this???
			// 		...should we use direction???
			var target = crop.getImage(this.current, 'after', list)
				|| crop.getImage(this.current, 'before', list) }
		crop.focusImage(target)

		// XXX ???
		//crop.parent = this
		//crop.root = this.root == null ? this : this.root

		return crop },

	// Merge changes from crop into data...
	//
	// NOTE: this may result in empty ribbons...
	//
	// XXX what are we doing with new ribbons???
	// XXX sync ribbon order???
	// XXX should we be able to align a merged crop???
	// XXX test
	mergeCrop: function(crop){
		var that = this

		this.order = crop.order.slice()
		// XXX sync these???
		this.ribbon_order = crop.ribbon_order.slice()
		this.updateImagePositions()

		// 
		for(var k in crop.ribbons){
			var local = k in this.ribbons ? 
				this.ribbons[k] 
				: []
			var remote = crop.ribbons[k]

			this.ribbons[k] = local

			remote.forEach(function(e){
				// add gid to local ribbon...
				local.indexOf(e) < 0
					&& this.shiftImage(e, k) }) }

		return this },

	// Create a sortable ribbon representation...
	//
	// 	.cropRibbons()
	// 	.cropRibbons(mode)
	// 		-> Data
	//
	// mode controls which images represent each ribbon, it can be:
	// 	'current'	- the closest to current image (default)
	// 	'first'		- first image in ribbon
	// 	'last'		- last ribbon in image
	// 	func(ribbon) -> gid
	// 				- a function that will get a ribbon gid and return 
	// 				  an apropriate image gid
	//
	// NOTE: the images used with a given string mode are the same as 
	// 		the returned via .getImage(mode, ribbon)
	//
	// 				v
	// 		 oooooo|a|ooooooo
	// 		ooooooo|A|ooooooooooooo		->		aAa
	// 			ooo|a|ooooo
	//
	//
	// The resulting data will contain a single ribbon, each image in 
	// which represents a ribbon in the source data.
	// This view allows convenient sorting of ribbons as images.
	//
	// The crop can be merged back into the source ribbon via the 
	// .mergeRibbonCrop(..) method.
	//
	// XXX should there be a way to set the base ribbon???
	// XXX should this link to .root and .parent data???
	// XXX do these belong here???
	cropRibbons: function(mode){
		mode = mode == null ? 'current' : mode
		var crop = new Data()

		// get image representations from each ribbon...
		var that = this
		var images = this.ribbon_order.map(
			typeof(mode) == typeof('str') 
				? function(e){ return that.getImage(mode, e) }
				: mode)

		var r = crop.newRibbon()

		crop.ribbons[r] = images
		crop.order = images.slice()
		crop.base = r
		crop.current = images[0]

		// XXX ???
		//crop.parent = this
		//crop.root = this.root == null ? this : this.root

		return crop },

	// Merge the sortable ribbon representation into data...
	//
	// This will take the image order from the crop and merge it into 
	// the .ribbon_order of this, essentially sorting ribbons...
	//
	// NOTE: see .cropRibbons(..) for more details...
	// NOTE: this will set the base to the top ribbon, but only if base
	// 		was the top ribbon (default) in the first place...
	// 		XXX is this correct???
	//
	// XXX should there be a way to set the base ribbon???
	// XXX TEST
	mergeRibbonCrop: function(crop){
		var b = this.ribbon_order.indexOf(this.base)
		var that = this
		this.ribbon_order = crop.order
			.map(function(e){
				return that.getRibbon(e) })
		// set the base to the first/top ribbon...
		// XXX is this the correct way???
		b == 0
			&& (this.base = this.ribbon_order[0])
		return this },


	// Clone/copy the data object...
	//
	clone: function(){
		//var res = new Data()
		var res = new this.constructor()
		res.base = this.base
		res.current = this.current
		res.order = this.order.slice()
		res.ribbon_order = this.ribbon_order.slice()

		this.eachImageList(function(lst, k, s){
			res[s] == null
				&& (res[s] = {})
			res[s][k] = this[s][k].slice() })

		return res },

	// Reset the state to empty...
	//
	_reset: function(){
		delete this.__base
		delete this.__current

		this.order = []
		this.ribbon_order = []
		this.ribbons = {}

		return this },



	/****************************************** JSON serialization ***/

	// Load data from JSON...
	//
	// NOTE: this loads in-place, use .fromJSON(..) to create new data...
	// XXX should this process defaults for unset values???
	load: function(data, clean){
		var that = this
		data = typeof(data) == typeof('str') ? JSON.parse(data) : data
		var version = data.version
		data = formats.updateData(data, DATA_VERSION)

		// report version change...
		delete this.version_updated
		if(data.version != version){
			this.version_updated = true }

		this.order = data.order.slice()
		this.ribbon_order = data.ribbon_order.slice()

		// make sparse lists...
		this.__gid_lists.forEach(function(s){
			if(data[s] == null){
				return }
			that[s] == null
				&& (that[s] = {})
			for(var k in data[s]){
				that[s][k] = that.makeSparseImages(data[s][k]) } })

		this.current = data.current
		this.base = data.base

		// extra data...
		!clean
			&& Object.keys(data)
				.forEach(function(k){
					k != 'version' 
						&& that[k] === undefined
						&& (that[k] = data[k]) })
		return this },

	// Generate JSON from data...
	//
	json: function(){
		var res = {
			version: DATA_VERSION,
			base: this.base,
			current: this.current,
			order: this.order.slice(),
			ribbon_order: this.ribbon_order.slice(),
			ribbons: {},
		}
		// compact sets...
		this.eachImageList(function(lst, k, s){
			res[s] == null
				&& (res[s] = {})
			res[s][k] = lst.compact() })
		return res },
	


	/*****************************************************************/
	// XXX is this a good name for this??? (see: object.js)
	__init__: function(json){
		// load initial state...
		json != null ?
			this.load(json)
			: this._reset()
		return this },
}


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var BaseData = 
module.BaseData = 
	object.Constructor('BaseData', 
		DataClassPrototype, 
		DataPrototype)



//---------------------------------------------------------------------

// XXX revise...
// XXX make a API compatible replacement to the above -- to access 
// 		compatibility and performance...
var DataWithTagsPrototype = {
	__proto__: DataPrototype,

	//__tags: null,
	get tags(){
		return (this.__tags = this.__tags || new tags.Tags()) },
	set tags(value){
		this.__tags = value },

	get untagged(){
		var v = new Set(this.tags.values())
		return this.getImages()
			.filter(function(gid){ return !v.has(gid) }) },

	// XXX do we need these???
	hasTag: function(gid, ...tags){
		return this.tags.tags(this.getImage(gid), ...tags) },
	getTags: function(gids){
		var that = this
		gids = arguments.length > 1 ? [...arguments] 
			: gids == null || gids == 'current' ? this.getImage() 
			: gids
		gids = gids == null ? [] : gids
		gids = gids instanceof Array ? gids : [gids]

		return gids
			.map(function(gid){
				return that.tags.tags(gid) })
			.flat()
			.unique() },

	// XXX should these normalize the list of gids via .getImages(gids)
	// 		or stay optimistic...
	tag: function(tags, gids){
		this.tags.tag(tags,
			gids == null || gids == 'current' ? 
				this.current
			: gids == 'ribbon' ?
				this.getImages('current')
			: gids == 'loaded' ?
				this.getImages('loaded')
			: gids == 'all' ?
				this.getImages('all')
			: gids)
		return this },
	untag: function(tags, gids){
		this.tags.untag(tags, 
			gids == null || gids == 'current' ? 
				this.current
			: gids == 'ribbon' ?
				this.getImages('current')
			: gids == 'loaded' ?
				this.getImages('loaded')
			: gids == 'all' ?
				this.getImages('all')
			: gids)
		return this },
	toggleTag: function(tag, gids, action){
		var that = this
		return this.tags.toggle(tag, 
				gids == null || gids == 'current' ? 
						this.current
					: gids == 'ribbon' ?
						this.getImages('current')
					: gids == 'loaded' ?
						this.getImages('loaded')
					: gids == 'all' ?
						this.getImages('all')
					: gids, 
				action)
			.run(function(){
				return this === that.tags ?
					that
					: this }) },


	// XXX should these be .tags.query(..) ???
	tagQuery: function(query){
		return this.tags.query(query) },


	// Utils...
	//
	// Load tags from images...
	//
	// 	Merge image tags to data...
	// 	.tagsFromImages(images)
	// 		-> data
	//
	// 	Load image tags to data dropping any changes in data...
	// 	.tagsFromImages(images, 'reset')
	// 		-> data
	//
	// XXX should this be here???
	// XXX this depends on image structure...
	tagsFromImages: function(images, mode){
		if(mode == 'reset'){
			delete this.__tags }
		for(var gid in images){
			var img = images[gid]
			img.tags != null
				&& this.tag(img.tags, gid) }
		return this },
	// Transfer tags to images...
	//
	// 	Merge data tags to images...
	// 	.tagsToImages(images)
	// 	.tagsToImages(images, true)
	// 	.tagsToImages(images, 'merge')
	// 		-> data
	//
	// 	Merge data tags to images without buffering...
	// 	.tagsToImages(images, 'unbuffered')
	// 		-> data
	//
	// 	Reset image tags from data...
	// 	.tagsToImages(images, 'reset')
	// 		-> data
	//
	// XXX should this be here???
	// XXX this depends on image structure...
	// XXX should this use image API for creating images???
	// XXX migrate to new tag API...
	// XXX revise how updated is handled... set or list???
	tagsToImages: function(images, mode, updated){
		throw Error('.tagsToImages(..): Not implemented.')
		mode = mode || 'merge'
		updated = updated || []

		// mark gid as updated...
		var _updated = function(gid){
			updated != null 
				&& updated.includes(gid)
				&& updated.push(gid) }
		// get or create an image with tags...
		// XXX should this use image API for creating???
		var _get = function(images, gid){
			var img = images[gid]
			// create a new image...
			if(img == null){
				img = images[gid] = {}
				_updated(gid) }

			var tags = img.tags
			// no prior tags...
			if(tags == null){
				tags = img.tags = []
				_updated(gid) }

			return img }

		// buffered mode...
		// 	- uses more memory
		// 	+ one write mer image
		if(mode != 'unbuffered'){
			// build the buffer...
			var buffer = {}
			this.tagsToImages(buffer, 'unbuffered')

			// reset mode...
			if(mode == 'reset'){
				// iterate through all the gids (both images and buffer/data)
				for(var gid in Object.keys(images)
						.concat(Object.keys(buffer))
						.unique()){
					// no tags / remove...
					if(buffer[gid] == null || buffer[gid].tags.length == 0){
						// the image exists and has tags...
						if(images[gid] != null && images[gid].tags != null){
							delete images[gid].tags
							_updated(gid)
						}

					// tags / set...
					} else {
						var img = _get(images, gid)
						var before = img.tags.slice()

						img.tags = buffer[gid].tags

						// check if we actually changed anything...
						if(!before.setCmp(img.tags)){
							_updated(gid)
						}
					}
				}

			// merge mode...
			} else {
				for(var gid in buffer){
					var img = _get(images, gid)
					var l = img.tags.length
					img.tags = img.tags
						.concat(buffer[gid].tags)
						.unique()
					// we are updated iff length changed...
					// NOTE: this is true as we are not removing anything 
					// 		thus the length can only increase if changes are
					// 		made...
					if(l != img.tags.length){
						_updated(gid)
					}
				}
			}

		// unbuffered (brain-dead) mode...
		// 	+ no extra memory
		// 	- multiple writes per image (one per tag)
		} else {
			var tagset = this.tags
			for(var tag in tagset){
				tagset[tag].forEach(function(gid){
					var img = _get(images, gid)

					if(img.tags.indexOf(tag) < 0){
						img.tags.push(tag)
						_updated(gid)
					}
				})
			}
		}
		return this
	},


	// Extended methods...
	//
	// special case: make the tags mutable...
	crop: function(){
		//var crop = DataWithTagsPrototype.__proto__.crop.apply(this, arguments)
		var crop = object.parentCall(DataWithTags.prototype.crop, this, ...arguments)
		crop.tags = this.tags
		return crop },
	join: function(...others){
		//var res = DataWithTagsPrototype.__proto__.join.apply(this, arguments)
		var res = object.parentCall(DataWithTags.prototype.join, this, ...arguments)
		// clear out the align mode...
		!(others[0] instanceof Data)
			&& others.shift()
		res.tags.join(...others
			.map(function(other){ 
				return other.tags }))
		return res },
	// XXX should this account for crop???
	// XXX test...
	split: function(){
		//var res = DataWithTagsPrototype.__proto__.split.apply(this, arguments)
		var res = object.parentCall(DataWithTags.prototype.split, this, ...arguments)
		res.tags = res.tags.keep(res.order)
		return res },
	clone: function(){
		//var res = DataWithTagsPrototype.__proto__.clone.apply(this, arguments)
		var res = object.parentCall(DataWithTags.prototype.clone, this, ...arguments)
		res.tags = this.tags.clone()
		return res },
	_reset: function(){
		//var res = DataWithTagsPrototype.__proto__._reset.apply(this, arguments)
		var res = object.parentCall(DataWithTags.prototype._reset, this, ...arguments)
		delete this.__tags
		return res },
	json: function(){
		//var json = DataWithTagsPrototype.__proto__.json.apply(this, arguments)
		var json = object.parentCall(DataWithTags.prototype.json, this, ...arguments)
		json.tags = this.tags.json()
		return json },
	load: function(data, clean){
		//var res = DataWithTagsPrototype.__proto__.load.apply(this, arguments)
		var res = object.parentCall(DataWithTags.prototype.load, this, ...arguments)
		data.tags
			&& res.tags.load(data.tags)
		return res },
}



// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var DataWithTags = 
module.DataWithTags = 
	object.Constructor('DataWithTags', 
		DataClassPrototype, 
		DataWithTagsPrototype)



//---------------------------------------------------------------------

// Proxy Data API to one of the target data objects...
var DataProxyPrototype = {
	//__proto__: DataPrototype,
	__proto__: DataWithTagsPrototype,

	datasets: null,

	get order(){
		// XXX
	},

}



//---------------------------------------------------------------------

var Data =
module.Data = DataWithTags



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })

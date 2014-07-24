/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}
console.log('>>> images')

//var DEBUG = DEBUG != null ? DEBUG : true



/*********************************************************************/

// cmp functions...
// XXX is this the right way to seporate these???

module.makeImageDateCmp = function(data, get){
	return function(a, b){
		if(get != null){
			a = get(a)
			b = get(b)
		}
		b = data[b].ctime
		a = data[a].ctime

		if(a == b){
			return 0
		} else if(a < b){
			return -1
		} else {
			return +1
		}
	}
}

// NOTE: this expects gids...
module.makeImageNameCmp = function(data, get){
	return function(a, b){
		if(get != null){
			a = get(a)
			b = get(b)
		}
		a = data.getImageFileName(a)
		b = data.getImageFileName(b)
		if(a == b){
			return 0
		} else if(a < b){
			return -1
		} else {
			return +1
		}
	}
}

module.makeImageSeqOrNameCmp = function(data, get, seq){
	seq = seq == null ? data.getImageNameSeq : seq

	return function(a, b){
		// XXX this is ugly and non-generic...
		if(get != null){
			a = get(a)
			b = get(b)
		}
		// XXX this is ugly and non-generic...
		var aa = seq.call(data, a)
		var bb = seq.call(data, b)

		// special case: seq, name
		if(typeof(aa) == typeof(123) && typeof(bb) == typeof('str')){ return -1 }
		// special case: name, seq
		if(typeof(aa) == typeof('str') && typeof(bb) == typeof(123)){ return +1 }

		// get the names if there are no sequence numbers...
		// NOTE: at this point both a and b are either numbers or NaN's...
		a = isNaN(aa) ? data.getImageFileName(a) : aa
		b = isNaN(bb) ? data.getImageFileName(b) : bb

		// do the actual comparison
		if(a == b){
			return 0
		} else if(a < b){
			return -1
		} else {
			return +1
		}
	}
}



/*********************************************************************/

var ImagesClassPrototype =
module.ImagesClassPrototype = {
	fromJSON: function(data){
		return new this().loadJSON(data)
	},
}


var ImagesPrototype =
module.ImagesPrototype = {

	// Generic helpers...
	// XXX are these slower than doing it manualy via Object.keys(..)
	forEach: function(func){
		var i = 0
		for(var key in this){
			func.call(this[key], key, this[key], i++, this)
		}
		return this
	},
	map: function(func){
		var res = this.constructor()
		var i = 0
		for(var key in this){
			res[k] = func.call(this[key], key, this[key], i++, this)
		}
		return res
	},
	filter: function(func){
		var res = this.constructor()
		var i = 0
		for(var key in this){
			if(func.call(this[key], key, this[key], i++, this)){
				res[key] = this[key]
			}
		}
		return res
	},


	// Image data helpers...

	// Get image filename...
	getImageFileName: function(gid, do_unescape){
		do_unescape = do_unescape == null ? true : do_unescape
		if(do_unescape){
			return unescape(this[gid].path.split('/').pop())
		} else {
			return this[gid].path.split('/').pop()
		}
	},
	// Get the first sequence of numbers in the file name...
	getImageNameSeq: function(gid){
		var n = this.getImageFileName(gid)
		var r = /([0-9]+)/m.exec(n)
		return r == null ? n : parseInt(r[1])
	},
	// Get the sequence of numbers in the file name but only if it is 
	// at the filename start...
	getImageNameLeadingSeq: function(gid){
		var n = this.getImageFileName(gid)
		var r = /^([0-9]+)/g.exec(n)
		return r == null ? n : parseInt(r[1])
	},


	// Gid sorters...
	// XXX chainCmp(..) is loaded from lib/jli.js
	sortImages: function(gids, cmp, reverse){
		gids = gids == null ? Object.keys(this) : gids

		cmp = cmp == null ? module.makeImageDateCmp(this) : cmp
		cmp = cmp.constructor.name == 'Array' ? chainCmp(cmp) : cmp

		gids = gids.sort(cmp)
		gids = reverse ? gids.reverse() : gids

		return gids
	},
	// Shorthands...
	// XXX these seem a bit messy...
	sortByDate: function(gids, reverse){ return this.sortImages(gids, null, reverse) },
	sortByName: function(gids, reverse){
		return this.sortImages(gids, module.makeImageNameCmp(this), reverse) },
	sortBySeqOrName: function(gids, reverse){ 
		return this.sortImages(gids, module.makeImageSeqOrNameCmp(this), reverse) },
	sortByNameXPStyle: function(gids, reverse){ 
		return this.sortImages(gids, 
				module.makeImageSeqOrNameCmp(this, null, this.getImageNameLeadingSeq), 
				reverse) },
	sortByDateOrSeqOrName: function(gids, reverse){
		return this.sortImages(gids, [
					module.makeImageDateCmp(this),
					module.makeImageSeqOrNameCmp(this)
				], reverse)
	},
	// XXX 
	sortedImagesByFileNameSeqWithOverflow: function(gids, reverse){
		// XXX see ui/sort.js
	},


	// serialization...
	loadJSON: function(data){
		data = typeof(data) == typeof('str') 
			? JSON.parse(data) 
			: JSON.parse(JSON.stringify(data))
		for(var k in data){
			this[k] = data[k]
		}
		return this
	},
	dumpJSON: function(data){
		return JSON.parse(JSON.stringify(this))
	},

	_reset: function(){
	},
}



/*********************************************************************/

// Main Images object...
//
var Images = 
module.Images =
function Images(json){
	// in case this is called as a function (without new)...
	if(this.constructor.name != 'Images'){
		return new Images(json)
	}

	// load initial state...
	if(json != null){
		this.loadJSON(json)
	} else {
		this._reset()
	}

	return this
}
Images.__proto__ = ImagesClassPrototype
Images.prototype = ImagesPrototype
Images.prototype.constructor = Images



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })

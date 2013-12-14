/**********************************************************************
* 
*
**********************************************************************/



/**********************************************************************
* Info & status...
*/

// XXX do we need a full rewrite here, or will it be better to just fill
// 		the slots...
function updateGlobalImageInfo(image){
	image = image == null ? getImage() : $(image)
	image = image.length == 0 ? getImage() : image

	var elem = $('.global-image-info')
	if(elem.length == 0){
		elem = $('<div class="global-image-info"/>')
	}

	// no image no update...
	if(image.length == 0){
		return elem
	}

	var gid = getImageGID(image)
	var r = getRibbonIndex(getRibbon(image))
	var data = IMAGES[gid]
	var date = new Date(data.ctime * 1000)

	var meta = []

	image.hasClass('bookmarked') ? meta.push(
			'<span class="shown">B</span>'+
			'<span class="hidden"><b>B</b>ookmarked</span>') : ''

	image.hasClass('marked') ? meta.push(
			'<span class="shown">M</span>'+
			'<span class="hidden"><b>M</b>arked</span>') : ''

	var orientation = data.orientation
	orientation = orientation == null ? 0 : orientation
	orientation != 0 ? meta.push(
			'<span class="shown">R</span>'+
			'<span class="hidden"><b>R</b>otated: '+orientation+'&deg;CW</span>') : ''

	var flip = data.flipped
	flip != null ? meta.push(
				'<span class="shown">F</span>'+
				'<span class="hidden"><b>F</b>lipped: '+
					//flip.map(function(e){ return e[0].capitalize() }).join(', ')+
					flip.map(function(e){ return e.capitalize() }).join(', ')+
				'</span>') 
			: ''


	meta = meta.join(', ') 
	meta = meta != '' ? '( '+ meta +' )' : ''

	return updateInfo(elem,
			// path...
			'<span class="expanding-text path">'+
				'<span class="shown">'+
					getImageFileName(gid) +
				'</span>'+
				'<span class="hidden" '+
						'style="position:absolute;'+
								'background: black;'+
								'padding: 3px;'+
								'top: 0px;'+
								'left: 0px;'+
								'width: 100%;'+
								'height: 100%"'+
						'>'+
					normalizePath(data.path) +
				'</span>'+ 
			'</span> '+ 

			// metadata...
			'<span class="secondary expanding-text metadata">'+
				meta +
			'</span> '+
			'<span class="secondary expanding-text metadata">'+
				// XXX do we need to display a short gid?
				//gid +
				'GID:'+
				'<span class="shown">'+ 
					gid.slice(gid.length-6) +
				'</span>'+
				'<span class="hidden"> '+
					(gid.length >= 6 ? 
					 	(gid.slice(0, gid.length-6) +'<b>'+ gid.slice(gid.length-6) +'</b>') 
						: gid)+
				'</span>'+
			'</span> '+

			// date...
			'<span class="secondary expanding-text date">'+
				'<span class="shown">TS:' + date.toShortDate() + '</span>'+
				'<span class="hidden"><b>' + date.toString() + '</b></span>'+
			'</span>'+

			// position...
			'<span class="float-right position">('+ 
				(DATA.ribbons[r].indexOf(gid)+1) +'/'+ DATA.ribbons[r].length +
			')<span/>')
}


function updateInlineImageInfo(image, target){
	image = image == null ? getImage() : $(image)
	image = image.length == 0 ? getImage() : image
	target = target == null ? image : target

	var elem = $('.inline-image-info')
	if(elem.length == 0){
		elem = $('<div class="inline-image-info"/>')
	}

	// no image no update...
	if(image.length == 0){
		return elem
	}


	var gid = getImageGID(image)
	//var r = getRibbonIndex(getRibbon(image))
	var data = IMAGES[gid]
	var date = new Date(data.ctime * 1000)

	var orientation = data.orientation
	orientation = orientation == null ? 0 : orientation

	return updateInfo(elem,
			// name...
			getImageFileName(gid) +'<br>'+

			// date...
			'<span class="secondary expanding-text date">'+
				//date.toShortDate() +
				'<span class="shown">' + date.toShortDate() + '</span>'+
				'<span class="hidden"><b>' + date.toString() + '</b></span>'+
			'</span>'+
			'',
			target)
}


function inlineImageInfoHoverHandler(evt){
	if($(evt.target).hasClass('current-marker')){
		var img = getImage()
		var target = $('.current-marker')
	} else {
		var img = $(evt.target).closest('.image')
		var target = img
	}
	if(img.length > 0){
		if(target.find('.inline-image-info:visible').length == 0){
			updateInlineImageInfo(img, target)
		}
	}
}



/**********************************************************************
* vim:set ts=4 sw=4 spell nowrap :                                   */

# -*- coding:utf-8 -*-
#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20140814025456'''
__copyright__ = '''(c) Alex A. Naanou 2011'''


#-----------------------------------------------------------------------

import os
# support both pil and pillow...
try:
	import Image
except ImportError:
	from PIL import Image
import json
import sha
import urllib2
import time
import tempfile
from optparse import OptionParser, OptionGroup

# XXX hack...
from io import open

try:
	import pyexiv2 as metadata
except:
	metadata = None

from pli.logictypes import OR

import gid


#-----------------------------------------------------------------------

##!!! I Hate Python for this!
##!!! ...there seems no good way to get this...
DEFAULT_ENCODING = 'cp1251'

CONFIG = {
	'absolute-path': False,
	'ignore-orientation': False,

	'full-scan': False,
	'force-ascii': False,

	# this can be:
	# 	- original (default)
	# 	- preview size
	# 	- metadata
	'gid-source': 'original',

	'base-ribbon': 0,
	'tags': [
		'unsorted',
	],

	'cache-image-name': '%(guid)s - %(name)s',

	# the rest of the paths will be relative to this...
	'cache-dir': '.ImageGrid',

	'images': 'images.json',
	'data': 'data.json',
	'marked': 'marked.json',
	'tagscache': 'tags.json',
	'filelist': 'filelist.json',

	'images-diff': '%(date)s-images-diff.json',
	'data-diff': '%(date)s-data.json',
	'marked-diff': '%(date)s-marked.json',
	'tags-diff': '%(date)s-tags.json',

	'config': 'ImageGrid.cfg',
	'error': 'error.log',

	'cache-structure': {
		# make these as close to standard as possible and keep sane 
		# distances...
		'150px': '150px/',
		'350px': '350px/',
		'900px': '900px/',
		'1080px': '1080px/',
		'1920px': '1920px/',
		'preview': 'preview/',
	},
	'sizes': {
		'150px': 150,
		'350px': 350,
		'900px': 900,
		'1080px': 1080,
##		'1920px': 1920,
	}
}

DATA = {
	'version': '2.0',
	'current': None,
	'ribbons': (),
	'order': (),
	'image_file': None,
}

ERR_LOG = '''\
ERROR: %(error)s
SOURCE: %(source-file)s
TARGET: %(target-file)s


'''


RAW = OR(
	# Nikon
	'NEF', 'nef', 
	# Panasonic/Leica
	'RW2', 'rw2',
	# Canon
	'CRW', 'crw',
	'CR2', 'cr2',
	# Sigma
	'X3F', 'x3f',
	# Adobe/Leica
	'DNG', 'dng',
)

IMAGE = OR(
	'jpg', 'jpeg', 'JPG', 'JPEG',
)


#-----------------------------------------------------------------------
# Helpers...

##!!! I hate python in everything that concerns encodings....
RESERVED_URL_CHARS = '%;/?:@&=+$, '
RESERVED_URL_TRANSLATION = dict([(RESERVED_URL_CHARS[i], '%'+e) 
		for i, e 
		# get the propper encodings...
		in enumerate(urllib2.quote(RESERVED_URL_CHARS).split('%'))])
def quote(s, safe=''):
	for k, v in RESERVED_URL_TRANSLATION.items():
		if k in safe:
			continue
		s = s.replace(k, v)
	return s
def unquote(s):
	for k, v in RESERVED_URL_TRANSLATION.items():
		s = s.replace(v, k)
	return s



#------------------------------------------------------------pathjoin---
def pathjoin(*p):
	'''
	'''
	return ('/'.join(p)).replace('//', '/')


#-------------------------------------------------------------getpath---
def getpath(root, path, absolute=False):
	'''
	'''
	if root in path:
		path = path.split(root)[-1]
		if path[0] in ('\\', '/'):
			path = path[1:]
	if absolute == True:
##		##!!! urllib2/urllib quote breaks on unicode...
##		return 'file:///' + urllib2.quote(pathjoin(root, path), safe='/:')
		return 'file:///' + quote(pathjoin(root, path), safe='/:')
	else:
##		##!!! urllib2/urllib quote breaks on unicode...
##		return urllib2.quote(pathjoin(path), safe='/:')
		return quote(pathjoin(path), safe='/:')


#-------------------------------------------------------------log_err---
def log_err(path, e, source_file, target_file):
	'''
	'''
	err_file = pathjoin(path, CONFIG['error'])
	if not os.path.exists(err_file):
		err = open(err_file, 'w')
	else:
		err = open(err_file, 'a')
	with err:
		err.write(ERR_LOG % {
				'source-file': source_file,
				'target-file': target_file,
				'error': e,
		})


#------------------------------------------------------------hash_gid---
def hash_gid(img, force=False):
	'''
	Generate gid based on preview file content.

	NOTE: img can be either a path or an Image.
	'''
	if type(img) in (str, unicode):
		img = Image.open(img)
	return sha.sha(img.tostring()).hexdigest()


#-----------------------------------------------------report_progress---
def report_progress(img, status):
	'''
	'''
	# created all previews...
	if False not in status:
		print '.',
	# created no previews...
	elif True not in status:
		print '-',
	# created some previews...
	else:
		print 'p',
	return img, status


#-----------------------------------------make_inline_report_progress---
def make_inline_report_progress(state=None):
	if state == None:
		state = {}
	if 'started at' not in state:
		state['done at'] = state['started at'] = time.time()

	def _inline_report_progress(img, status):
		created = state.get('created', 0)
		skipped = state.get('skipped', 0)
		partial = state.get('partial', 0)


		# created all previews...
		if False not in status:
			created += 1
			state['created'] = created

		# created no previews...
		elif True not in status:
			skipped += 1
			state['skipped'] = skipped

		# created some previews...
		else:
			partial += 1
			state['partial'] = partial

		state['done at'] = time.time()

		print 'Previews created: %s partial: %s skipped: %s...\r' % (created, partial, skipped),

		return img, status
	return _inline_report_progress


#----------------------------------------------------------mergediffs---
##!!! this is generic, move to pli?
def mergediffs(path, base, isdiff, merge, dfl, 
		get_latest_base=True, isversion=None, load=None, cmp=None, verbosity=0):
	'''
	load the base file and merge in all the diff files in order.
	'''
	res = dfl
	# if no cache dir...
	if not os.path.exists(path):
		return res
	# base images file...
	if get_latest_base:
		base_file, data = loadlatest(
				path, 
				isversion if isversion != None else lambda n: n.endswith(base),
				lambda n: n == base,
				load if load != None else lambda path: json.load(open(path)),
				{},
				cmp,
				verbosity=verbosity)
		res.update(data)
		base_date = os.path.basename(base_file).split('-')[0]
	else:
		target = pathjoin(path, base)
		base_date = ''
		if os.path.exists(target):
			if verbosity >= 1:
				print 'Loading: %s' % target
			merge(res, target)
	# apply diff files...
	files = os.listdir(path)
	if cmp == None:
		files.sort()
	else:
		files.sort(cmp)
	for n in files:
		# skip non-diffs and diffs older than base...
		if isdiff(n) and n.split('-')[0] >= base_date:
			target = pathjoin(path, n)
			# XXX is this the correct way???
			if verbosity >= 1:
				print 'Loading: %s' % target
			merge(res, target)
	return res


#----------------------------------------------------------loadlatest---
##!!! this is generic, move to pli?
def loadlatest(path, isversion, isbase, load, dfl, cmp=None, verbosity=0):
	'''
	load latest version of the file.

	NOTE: the base file will always be loaded last, if it exists and no
		other versions are found.
	'''
	data = dfl
	base = None
	# if no cache dir...
	if not os.path.exists(path):
		return path, data
	files = os.listdir(path)
	if cmp == None:
		files.sort()
		files.reverse()
	else:
		files.sort(cmp)
	for n in files:
		if isbase(n):
			base = pathjoin(path, n)
			continue
		if isversion(n):
			target = pathjoin(path, n)
			# XXX is this the correct way???
			if verbosity >= 1:
				print 'Loading: %s' % target
			return target, load(target)
	if base != None:
		# XXX is this the correct way???
		if verbosity >= 1:
			print 'Loading: %s' % base
		return base, load(base)
	return 'default', data



#-----------------------------------------------------------------------
# API...
#-----------------------------------------------------------getimages---
def getimages(path, config=CONFIG, verbosity=0):
	'''
	'''
	return mergediffs(
			pathjoin(path, config['cache-dir']), 
			config['images'], 
			# XXX avoid hardcoded sufexes...
			lambda n: n.endswith('-images-diff.json'), 
			lambda data, path: (data.update(json.load(open(path))), data)[-1],
			{},
			verbosity=verbosity)


#-------------------------------------------------------------getdata---
def getdata(path, config=CONFIG, verbosity=0):
	'''
	'''
	return loadlatest(
			pathjoin(path, config['cache-dir']), 
			lambda n: n.endswith(config['data']),
			lambda n: n == config['data'],
			lambda path: json.load(open(path)),
			{},
			verbosity=verbosity)[-1]


#-----------------------------------------------------------getmarked---
def getmarked(path, config=CONFIG, verbosity=0):
	'''
	'''
	return loadlatest(
			pathjoin(path, config['cache-dir']), 
			lambda n: n.endswith(config['marked']),
			lambda n: n == config['marked'],
			lambda path: json.load(open(path)),
			[],
			verbosity=verbosity)[-1]


#-------------------------------------------------------------gettags---
def gettags(path, config=CONFIG, verbosity=0):
	'''
	'''
	return loadlatest(
			pathjoin(path, config['cache-dir']), 
			lambda n: n.endswith(config['tagscache']),
			lambda n: n == config['tagscache'],
			lambda path: json.load(open(path)),
			{},
			verbosity=verbosity)[-1]


#----------------------------------------------------build_cache_dirs---
def build_cache_dirs(path, config=CONFIG, dry_run=False, verbosity=0):
	'''
	Build cache directory tree.
	'''
	if verbosity >= 1:
		print 'Creating cache directory structure...'

	cache_dir = config['cache-dir']
	dirs = config['cache-structure']

	for _, k in dirs.items():
		p = pathjoin(path, cache_dir, k)

		if not os.path.exists(p):
			if not dry_run:
				os.makedirs(p)
			if verbosity >= 2:
				print 'Creating directory: %s' % p
		elif verbosity >= 2:
			print 'Directory exists: %s' % p


#--------------------------------------------------------build_images---
def build_images(path, config=CONFIG, gid_generator=hash_gid, dry_run=False, verbosity=0):
	'''
	Build image structures update images.json in cache.
	'''
	absolute_path = config['absolute-path']
	full_scan = config['full-scan']
	cache_dir = config['cache-dir']

	orientation = 0

	# build a file-list...
	# XXX should this be split out into a seporate function???
	filelist = pathjoin(path, cache_dir, config['filelist'])
	# NOTE: we do not need to filter anything here as all the filtering
	# 		will anyway happen later on...
	# 		...in addition to that the filtering rules may change
	# 		between runs.
	files = os.listdir(path)
	# remove the already scanned files (the ones in the filelist)...
	if not full_scan and os.path.exists(filelist):
		if verbosity >= 1:
			print 'Loading: %s' % filelist
		with open(filelist) as f:
			old_files = json.load(f)
		cur_files = files[:]
		# strip the processed files...
		files = list(set(files).difference(old_files))
		files.sort()
		if len(files) > 0:
			if verbosity >= 1:
				print 'Writing: %s' % filelist
			if not dry_run:
				with open(filelist, 'w', 
						encoding='ascii' if config['force-ascii'] else 'utf-8') as f:
##					##!!! json.dump writes some "strings" as unicode and some as str
##					##!!! this breaks fp.write(...)...
##					json.dump(cur_files, f, indent=4, ensure_ascii=config['force-ascii'])
					s = json.dumps(cur_files, f, indent=4, ensure_ascii=config['force-ascii'])
					if not config['force-ascii'] and type(s) != unicode:
						s = s.decode(DEFAULT_ENCODING)
					f.write(s)
	# just write the list...
	else:
		if verbosity >= 1:
			print 'Writing: %s' % filelist
		if not dry_run:
			with open(filelist, 'w', 
					encoding='ascii' if config['force-ascii'] else 'utf-8') as f:
##				##!!! json.dump writes some "strings" as unicode and some as str
##				##!!! this breaks fp.write(...)...
##				json.dump(files, f, indent=4, ensure_ascii=config['force-ascii'])
				s = json.dumps(files, f, indent=4, ensure_ascii=config['force-ascii'])
				if not config['force-ascii'] and type(s) != unicode:
					s = s.decode(DEFAULT_ENCODING)
				f.write(s)

	for name in files:
		fname, ext = os.path.splitext(name)
		ext = ext[1:]

		# extract raw preview...
		# XXX this is really slow, need a better way to do this...
		if ext == RAW and metadata != None:
			source_path = pathjoin(path, name)
			raw = metadata.ImageMetadata(source_path)
			raw.read()
			orientation = raw['Exif.Image.Orientation']
			##!!! can there be no previews?
			# get the biggest preview...
			preview = raw.previews[0]
			for p in raw.previews:
				if max(preview.dimensions) < max(p.dimensions):
					preview = p

			source_path = pathjoin(path, cache_dir, CONFIG['cache-structure']['preview'], fname + '.jpg')

			with open(source_path, 'w+b') as p:
				p.write(preview.data)
			
			# copy metadata...
			preview = metadata.ImageMetadata(source_path)
			preview.read()
			raw.copy(preview)
			preview.write()

			if not config['ignore-orientation']:
				if 'Exif.Image.Orientation' in raw:
					orientation = raw['Exif.Image.Orientation'].value

		# normal images...
		elif ext == IMAGE:
			source_path = pathjoin(path, name)

			if not config['ignore-orientation']:
				meta = metadata.ImageMetadata(source_path)
				meta.read()
				if 'Exif.Image.Orientation' in meta:
					orientation = meta['Exif.Image.Orientation'].value

		# skip other files...
		else:
			continue

		if orientation not in range(0, 9):
			orientation = 0

		p = pathjoin(path, name)
		img =  {
			'id': gid_generator(source_path),
			'name': name,
			'type': 'image',
			'state': 'single',
			'tags': config.get('tags', []),
			'orientation': {
					0: 0,
					1: 0,
					2: 0,
					3: 180,
					4: 0,
					5: 90,
					6: 90,
					7: 90, 
					8: 270,
				}[orientation],
			'flipped': {
					0: None,
					1: None,
					2: ['horizontal'],
					3: None,
					4: ['vertical'],
					5: ['vertical'],
					6: None,
					7: ['horizontal'],
					8: None,
				}[orientation],
			'path': getpath(path, source_path, absolute_path),
			'ctime': min(
				# to compensate for touch updating mtime by default...
				os.path.getmtime(p),
				os.path.getctime(p)),
			'preview': {},
		}

		if verbosity >= 2:
			print (' '*72) + '\rProcessing image: %s' % getpath(path, source_path, absolute_path)


		yield img


#------------------------------------------------------build_previews---
# NOTE: this will create images in the file system.
def build_previews(image, path=None, config=CONFIG, dry_run=True, verbosity=0):
	'''

	NOTE: this needs the cache directory structure present.
	'''
	status = []
	# config...
	absolute_path = config['absolute-path']
	cache_dir = config['cache-dir']
	dirs = config['cache-structure']
	sizes = config['sizes'] 
	cache_name = config['cache-image-name']

	# data...
	gid = image['id']
	img_name = image['name']
	name = os.path.splitext(img_name)[0]
	img_path = image['path']

	if absolute_path == False:
##		source_path = os.path.join(path, img_path)
		source_path = os.path.join(path, urllib2.url2pathname(img_path))
	else:
		# XXX is this the best way???
		o = urllib2.urlopen(img_path)
		source_path = o.fp.name
		o.close()

	img = Image.open(source_path, 'r')

	# biggest preview is the original image...
	image['preview'][str(max(*img.size)) + 'px'] = img_path

	# previews...
	preview = None
	# NOTE: do the big previews first...
	s = sizes.items()
	s.sort(lambda a, b: cmp(b[1], a[1]))
	for k, spec in s:

		if k in image['preview'].keys():
			continue

		# build the two paths: relative and full...
		n = pathjoin(cache_dir, dirs[k], cache_name % {'guid': gid, 'name': name + '.jpg'})
		p = pathjoin(path, n)

		# do not upscale images...
		if max(*img.size) <= spec:
			continue

		# add image to index...
		if not os.path.exists(p):
			scale = spec/float(max(*img.size))
			preview = img.resize((int(img.size[0]*scale), int(img.size[1]*scale)), Image.ANTIALIAS)

			if not dry_run:
				preview.save(p, quality=80)
				# use the preview to speed things up...
				# NOTE: this will degrade the quality of previews after
				# 		several resizes...
				img = Image.open(p, 'r')
			else:
				del preview
##				preview.close()

			##!!! metadata???

			status += [True] 

		# image exists...
		else:
			status += [False] 

		image['preview'][str(spec) + 'px'] = getpath(path, n, absolute_path)

		if verbosity >= 2:
			print '    %s: %s' % ('C' if status[-1] else 'S', getpath(path, n, absolute_path))


	return image, status


#----------------------------------------------------------build_data---
##!!! add option to consider fav depth and build a correct ribbon structure...
def build_data(images, path, config=CONFIG):
	'''
	'''
	images_index = {}
	marked = None
	data = DATA.copy()
	ribbon = []

	for image in images:
		gid = image['id'] 

		images_index[gid] = image
		ribbon += [gid]

	# remove duplicate gids...
	ribbon = list(set(ribbon))
	ribbon.sort(lambda a, b: cmp(images_index[b]['ctime'], images_index[a]['ctime']))

	data['ribbons'] = [ribbon]
	data['order'] = ribbon[:]
	data['current'] = ribbon[0] if len(ribbon) > 0 else None

	return data, images_index, marked



#-----------------------------------------------------------------------
# High-level API...
#---------------------------------------------------------build_cache---
def build_cache(path, config=CONFIG, gid_generator=hash_gid, 
		report_progress=report_progress, dry_run=False, images_only=False, 
		verbosity=0):
	'''

	NOTE: when updating existing cache, this will re-sort the images.
	'''
	cache_dir = config['cache-dir']
	absolute_path = config['absolute-path']
	base_ribbon = config['base-ribbon']

	build_cache_dirs(path, config, dry_run, verbosity)

	if report_progress == None:
		report_progress = lambda a, b: a, b

	images_file = pathjoin(cache_dir, config['images'])
	data_file = pathjoin(cache_dir, config['data'])
	marked_file = pathjoin(cache_dir, config['marked'])
	tags_file = pathjoin(cache_dir, config['tagscache'])

	# load the json files if they exist....
	files = {
		images_file: getimages(path, config, verbosity=verbosity), 
		data_file: getdata(path, config, verbosity=verbosity), 
		marked_file: getmarked(path, config, verbosity=verbosity),
		tags_file: gettags(path, config, verbosity=verbosity),
	}
	_images = {} if files[images_file] == None else files[images_file]

	# build the data...
	data, images, marked = build_data(
			(i for i, status in (report_progress(
						*build_previews(img, path, config, dry_run=dry_run, verbosity=verbosity))
					for img in build_images(path, config, gid_generator, dry_run=dry_run, verbosity=verbosity))
				# get the image if at least one preview got updated,
				# the image did not exist in index before or its
				# previews changed... 
				if True in status 
						or i['id'] not in _images 
						or i['preview'] != _images[i['id']]['preview']),
			path, config)

	##!!! do we still need this???
	data['image_file'] = getpath(path, images_file, absolute_path)

	# get the new images...
	new_images = set(images).difference(_images)
	updated_images = set(images).difference(new_images)

	# if there is no difference in images then no data updates need to
	# be done...
	if len(new_images) > 0:
		# add new images...
		new_images = dict( (k, images[k]) for k in new_images)
		for k in updated_images:
			img = new_images[k] = _images[k]
			img['preview'].update(images[k]['preview'])
		images = new_images

		# update filenames if we are updating...
		d = time.strftime('%Y%m%d%H%M')
		if files[images_file] != {}:
			images_file = pathjoin(cache_dir, config['images-diff'] % {'date': d})
		if files[data_file] != {}:
			# build full image index...
			_images.update(images)
			# update ribbons...
			new, data = data['ribbons'][0], files[data_file]
			l = len(data['ribbons'][base_ribbon])
			data['ribbons'][base_ribbon] = list(set(data['ribbons'][base_ribbon] + new))

			# if length did not change then nothing new is found...
			if l == len(data['ribbons'][base_ribbon]):
				data = None

			else:
				data['ribbons'][base_ribbon].sort(
						lambda a, b: 
							cmp(_images[b]['ctime'], _images[a]['ctime']))
				# update and resort order...
				data['order'] = _images.keys()
				data['order'].sort(
						lambda a, b: 
							cmp(_images[b]['ctime'], _images[a]['ctime']))
				data_file = pathjoin(cache_dir, config['data-diff'] % {'date': d})
	else:
		images = None
		data = None

	# update marks only if the new marks are not empty...
	if files[marked_file] != [] and marked != None:
		marked_file = pathjoin(cache_dir, config['marked-diff'] % {'date': d})

	# buld the tags...
	if images != None and config['tags'] != []:
		tags = files[tags_file]
		if tags != {}:
			tags_file = pathjoin(cache_dir, config['tags-diff'] % {'date': d})
		if data == None:
			order = files[data_file]['order']
		else:
			order = data['order']
		new_gids = images.keys()
		new_tags = dict([ (tag, new_gids) for tag in config['tags'] ])
		no_change = 0
		for t, l in new_tags.items():
			if t in tags:
				# merge the tagged gids...
				l = list(set(tags[t] + l))
				if len(tags[t]) == len(l):
					no_change += 1
					continue
				tags[t] = l
			else:
				tags[t] = l
			# sort...
			l.sort(lambda a, b: cmp(order.index(a), order.index(b)))
		if no_change == len(new_tags):
			tags = None
	else:
		tags = None

	if verbosity >= 1:
		print

	if images_only:
		files = {
			images_file: images,
		}
	else:
		files = {
			images_file: images, 
			data_file: data, 
			marked_file: marked,
			tags_file: tags,
		}
	# write files...
	for n, d in files.items():
		# skip stuff...
		if d == None:
			continue
		n = os.path.join(path, n)
		if verbosity >= 1:
			print 'Writing: %s' % n
		if not dry_run:
			##!!! DO NOT OVERWRITE EXISTING DATA...
			with open(n, 'w', 
					encoding='ascii' if config['force-ascii'] else 'utf-8') as f:
##				##!!! json.dump writes some "strings" as unicode and some as str
##				##!!! this breaks fp.write(...)...
##				json.dump(d, f, indent=4, ensure_ascii=config['force-ascii'])
				s = json.dumps(d, f, indent=4, ensure_ascii=config['force-ascii'])
				if not config['force-ascii'] and type(s) != unicode:
					s = s.decode(DEFAULT_ENCODING)
				f.write(s)

	return data




#-----------------------------------------------------------------------
# Runtime...
#--------------------------------------------------handle_commandline---
def handle_commandline():
	'''
	Parse commandline args and act accordingly...
	'''
	res = None

	parser = OptionParser(
						usage='Usage: %prog [options] DIRS',
						version='%prog ' + __version__,
						epilog='Notes: This script is still experimental. '
							'GID source default will change to "metadata" '
							'in the future.')

	parser.add_option('-q', '--quiet',
						dest='verbosity',
						action='store_const',
						const=0,
						default=1,
						help='Run quietly.')
	parser.add_option('-v', '--verbose',
						dest='verbosity',
						action='store_const',
						const=2,
						default=1,
						help='Do full reporting.')
	parser.add_option('--debug',
						dest='verbosity',
						action='store_const',
						const=3,
						default=1,
						help='Print debug data.')

	parser.add_option('--dry-run', 
						action='store_true',
						default=False,
						help='Run but do not write anything to disk.') 


	output_configuration = OptionGroup(parser, 'Output configuration')
	output_configuration.add_option('--images-only', 
						action='store_true',
						default=False,
						help='Create only images.json file, skip the rest.') 
	output_configuration.add_option('--full-scan', 
						action='store_true',
						default=False,
						help='Do a full scan, ignoring existing file-lists.') 
	output_configuration.add_option('--ignore-orientation', 
						action='store_true',
						default=False,
						help='Ignore EXIF orientation data -- when previews '
							'are already in correct orientation.') 
	output_configuration.add_option('--path-mode',
						default='absolute' if CONFIG['absolute-path'] else 'relative',
						help='Path generation mode (default: "%default").')
	output_configuration.add_option('--gid-source',
						default=CONFIG['gid-source'],
						help='Source used for GID generation (default: "%default").')
	output_configuration.add_option('--base-ribbon',
						default=CONFIG['base-ribbon'],
						help='Base ribbon number (default: "%default").')
	output_configuration.add_option('-t', '--tag',
						action='append',
						default=CONFIG['tags'][:],
						help='add tag to each image (default: %default).',
						metavar='TAG')
	output_configuration.add_option('--notag',
						action='append',
						default=[],
						help='do not add tag to images (default: %default).',
						metavar='TAG')
	output_configuration.add_option('--force-ascii', 
						action='store_true',
						default=False,
						help='Force all json configs to be written in ASCII, '
							'this will fail if non-ASCII filenames are encountered.') 
	parser.add_option_group(output_configuration)


	configuration = OptionGroup(parser, 'Configuration options')
	configuration.add_option('--config-file',
						metavar='PATH',
						default=CONFIG['config'],
						help='Config file to search for (default: "%default").')
	configuration.add_option('--config-print', 
						action='store_true',
						default=False,
						help='Print current configuration and exit.')
	configuration.add_option('--config-defaults-print', 
						action='store_true',
						default=False,
						help='Print default configuration and exit.')
	configuration.add_option('--config-save-local', 
						action='store_true',
						default=False,
						help='Save current configuration at the root location. '
							'this is a shorthand for: '
							'%prog ... --config-print > DIR/CONFIG; %prog')
	parser.add_option_group(configuration)

	
	
	options, args = parser.parse_args()

	##!!! test if we are missing something...
##	if (len(args) != 1 
##			and True not in (options.config_defaults_print, options.config_print)):
##		parser.print_usage()
##		raise SystemExit

	config = {}
	config.update(CONFIG)

	# prepare the path...
	if len(args) < 1:
		args = [u'.']

	times = []

	##!!! move all that is not needed in the loop to outside the loop...
	for IN_PATH in args:

		if len(times) > 0:
			print

		IN_PATH = IN_PATH.replace('\\', '/')
		##!!! need to convert this ut utf-8...
		if not options.force_ascii and type(IN_PATH) != unicode:
			IN_PATH = IN_PATH.decode(DEFAULT_ENCODING)


		# load configuration files..
		config_name = options.config_file
		# local to script...
		if os.path.exists(config_name):
			with open(config_name) as f:
				config.update(json.load(f))
		# local to target...
		if os.path.exists(os.path.join(IN_PATH, config_name)):
			with open(os.path.join(IN_PATH, config_name)) as f:
				config.update(json.load(f))

		# update config according to set args...
		config.update({
				'gid-source': options.gid_source,
				'absolute-path': options.path_mode == 'absolute',
				'ignore-orientation': options.ignore_orientation,
				'base-ribbon': int(options.base_ribbon),
				'full-scan': options.full_scan,
				'force-ascii': options.force_ascii,
				})

		# build the tags...
		tags = config['tags'] = list(set(options.tag + config['tags']).difference(options.notag))

		# a value from 0 through 2...
		verbosity = options.verbosity
		# bool...
		dry_run = options.dry_run
		images_only = options.images_only

		# configuration stuff...
		# write a local configuration...
		if options.config_save_local:
			with open(os.path.join(IN_PATH, config_name), 'w', 
					encoding='ascii' if config['force-ascii'] else 'utf-8') as f:
	##			##!!! json.dump writes some "strings" as unicode and some as str
	##			##!!! this breaks fp.write(...)...
	##			f.write(json.dumps(config, sort_keys=True, indent=4, ensure_ascii=config['force-ascii']))
				s = json.dumps(config, sort_keys=True, indent=4, ensure_ascii=config['force-ascii'])
				if not config['force-ascii'] and type(s) != unicode:
					s = s.decode(DEFAULT_ENCODING)
				f.write(s)

		# print configuration data...
		if True in (options.config_defaults_print, options.config_print):

			# see if we need to print a prefix...
			print_prefix = False
			if len([ s for  s in  (options.config_defaults_print, options.config_print) if s]) > 1:
				print_prefix = True

			# do the prinitng...
			if options.config_print:
				if print_prefix:
					print 'Current Configuration:'
				print json.dumps(config, sort_keys=True, indent=4, ensure_ascii=config['force-ascii'])
				print
			if options.config_defaults_print:
				if print_prefix:
					print 'Default Configuration:'
				print json.dumps(CONFIG, sort_keys=True, indent=4, ensure_ascii=config['force-ascii'])
				print

		# do the actual work...
		# NOTE: we are not using verbosity 2 at this point...
		else:
			progress_state = {}

			if verbosity == 0:
				report = None
			elif verbosity >= 1:
				report = make_inline_report_progress(progress_state)

			# do the run...
			res = build_cache(IN_PATH, 
					config, 
					hash_gid, 
					report,
					dry_run=dry_run,
					images_only=images_only,
					verbosity=verbosity)

			# report results...
			if verbosity >= 1:
				times += [(progress_state['done at'] - progress_state['started at'])/60]
				print
				print 'Time: %.1fm' % (times[-1],)

	# report results...
	if verbosity >= 1 and len(times) > 1:
		print
		print 'Total time: %.1fm' % (sum(times),)
		
##	# XXX this makes the script spit out res to stdout...
##	return res



#-----------------------------------------------------------------------
if __name__ == '__main__':

	handle_commandline()



#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :

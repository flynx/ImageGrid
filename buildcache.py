#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20130629041032'''
__copyright__ = '''(c) Alex A. Naanou 2011'''


#-----------------------------------------------------------------------

import os
import Image
import json
import sha
import urllib2
import time
import tempfile
from optparse import OptionParser, OptionGroup

try:
	import pyexiv2 as metadata
except:
	metadata = None

from pli.logictypes import OR

import gid


#-----------------------------------------------------------------------

CONFIG = {
	'absolute-path': False,

	# this can be:
	# 	- original (default)
	# 	- preview size
	# 	- metadata
	'gid-source': 'original',

	'cache-image-name': '%(guid)s - %(name)s',

	# the rest of the paths will be relative to this...
	'cache-dir': '.ImageGrid',

	'images': 'images.json',
	'data': 'data.json',
	'marked': 'marked.json',

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
##		'1080px': 1080,
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
		return 'file:///' + urllib2.quote(pathjoin(root, path), safe='/:')
	else:
		return urllib2.quote(pathjoin(path), safe='/:')


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
	return img


#-----------------------------------------make_inline_report_progress---
def make_inline_report_progress(state=None):
	if state == None:
		state = {}
	if 'started at' not in state:
		state['started at'] = time.time()

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

		return img
	return _inline_report_progress



#-----------------------------------------------------------------------
# API...
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
def build_images(path, config=CONFIG, gid_generator=hash_gid, verbosity=0):
	'''
	Build image structures update images.json in cache.
	'''
	absolute_path = config['absolute-path']

	orientation = None

	for name in os.listdir(path):
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

			source_path = pathjoin(path, CONFIG['cache-dir'], CONFIG['cache-structure']['preview'], fname + '.jpg')

			with open(source_path, 'w+b') as p:
				p.write(preview.data)
			
			# copy metadata...
			preview = metadata.ImageMetadata(source_path)
			preview.read()
			raw.copy(preview)
			preview.write()

		# normal images...
		elif ext == IMAGE:
			source_path = pathjoin(path, name)
			meta = metadata.ImageMetadata(source_path)
			meta.read()
			if 'Exif.Image.Orientation' in meta:
				orientation = meta['Exif.Image.Orientation'].value
			else:
				orientation = 0

		# skip other files...
		else:
			continue

		img =  {
			'id': gid_generator(source_path),
			'name': name,
			'type': 'image',
			'state': 'single',
			'orientation': {
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
			'ctime': os.path.getctime(pathjoin(path, name)),
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
				preview.close()

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
	marked = []
	data = DATA.copy()
	ribbon = []

	for image in images:
		gid = image['id'] 

		images_index[gid] = image
		ribbon += [gid]

	ribbon.sort(lambda a, b: cmp(images_index[b]['ctime'], images_index[a]['ctime']))

	data['ribbons'] = [ribbon]
	data['order'] = ribbon[:]
	data['current'] = ribbon[0]

	return data, images_index, marked



#-----------------------------------------------------------------------
# High-level API...
#---------------------------------------------------------build_cache---
##!!! DO NOT OVERWRITE EXISTING DATA...
def build_cache(path, config=CONFIG, gid_generator=hash_gid, 
		report_progress=report_progress, dry_run=False, images_only=False, verbosity=0):
	'''
	'''
	cache_dir = config['cache-dir']
	absolute_path = config['absolute-path']

	build_cache_dirs(path, config, dry_run, verbosity)

	if report_progress == None:
		report_progress = lambda a, b: a

	data, images, marked = build_data(
			(report_progress(
					*build_previews(img, path, config, dry_run=dry_run, verbosity=verbosity))
				for img in build_images(path, config, gid_generator, verbosity=verbosity)), 
			path, config)

	images_file = pathjoin(cache_dir, config['images'])
	data_file = pathjoin(cache_dir, config['data'])
	marked_file = pathjoin(cache_dir, config['marked'])

	data['image_file'] = getpath(path, images_file, absolute_path)

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
		}
	for n, d in files.items():
		n = os.path.join(path, n)
		if verbosity >= 1:
			print 'Writing: %s' % n
		if not dry_run:
			##!!! DO NOT OVERWRITE EXISTING DATA...
			with open(n, 'w') as f:
				json.dump(d, f, indent=4)

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
						usage='Usage: %prog [options] ROOT',
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
	output_configuration.add_option('--path-mode',
						default='absolute' if CONFIG['absolute-path'] else 'relative',
						help='Path generation mode (default: "%default").')
	output_configuration.add_option('--gid-source',
						default=CONFIG['gid-source'],
						help='Source used for GID generation (default: "%default").')
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
							'%prog ... --config-print > ROOT/CONFIG; %prog')
	parser.add_option_group(configuration)

	
	
	options, args = parser.parse_args()

	##!!! test if we are missing something...
##	if (len(args) != 1 
##			and True not in (options.config_defaults_print, options.config_print)):
##		parser.print_usage()
##		raise SystemExit

	# prepare the path...
	if len(args) < 1:
		IN_PATH = '.'
	else:
		IN_PATH = args[0]
		IN_PATH = IN_PATH.replace('\\', '/')

	config = {}
	config.update(CONFIG)

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
			})
	# a value from 0 through 2...
	verbosity = options.verbosity
	# bool...
	dry_run = options.dry_run
	images_only = options.images_only

	# configuration stuff...
	# write a local configuration...
	if options.config_save_local:
		with file(os.path.join(IN_PATH, config_name), 'w') as f:
			f.write(json.dumps(config, sort_keys=True, indent=4))

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
			print json.dumps(config, sort_keys=True, indent=4)
			print
		if options.config_defaults_print:
			if print_prefix:
				print 'Default Configuration:'
			print json.dumps(CONFIG, sort_keys=True, indent=4)
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
			print
			print 'Time: %.1fm' % ((progress_state['done at'] - progress_state['started at'])/60)
		
	return res



#-----------------------------------------------------------------------
if __name__ == '__main__':

	handle_commandline()



#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :

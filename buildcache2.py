#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20130522014220'''
__copyright__ = '''(c) Alex A. Naanou 2011'''


#-----------------------------------------------------------------------

import os
import Image
import json
import sha
import urllib2

from pli.logictypes import OR

import gid


#-----------------------------------------------------------------------

CONFIG = {
	'absolute-path': False,

	'cache-image-name': '%(guid)s - %(name)s',

	'images': '.ImageGridCache/images.json',
	'data': '.ImageGridCache/data.json',
	'marked': '.ImageGridCache/marked.json',

	'error': '.ImageGridCache/error.log',

	'cache-structure': {
		# make these as close to standard as possible and keep sane 
		# distances...
		'150px': '.ImageGridCache/150px/',
		'350px': '.ImageGridCache/350px/',
		'900px': '.ImageGridCache/900px/',
		'1080px': '.ImageGridCache/1080px/',
		'1920px': '.ImageGridCache/1920px/',
	},
	'sizes': {
		'150px': 150,
		'350px': 350,
		'900px': 900,
		'1080px': 1080,
		'1920px': 1920,
	}
}

DATA = {
	'version': '2.0',
	'current': None,
	'ribbons': (),
	'order': (),
	'image_file': None,
}

IMAGE_EXT = OR(*(
		'.jpg', '.jpeg', '.JPG', '.JPEG',
))

ERR_LOG = '''\
ERROR: %(error)s
SOURCE: %(source-file)s
TARGET: %(target-file)s


'''


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
	if absolute == True:
		return 'file:///' + urllib2.quote(pathjoin(root, path), safe='/:')
	else:
		return urllib2.quote(path, safe='/')


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

		print 'Previews created: %s partial: %s skipped: %s...\r' % (created, partial, skipped),

		return img
	return _inline_report_progress



#-----------------------------------------------------------------------
# API...

#----------------------------------------------------build_cache_dirs---
def build_cache_dirs(path, config=CONFIG):
	'''
	Build cache directory tree.
	'''
	dirs = config['cache-structure']
	for _, k in dirs.items():
		p = pathjoin(path, k)
		if not os.path.exists(p):
			os.makedirs(p)


#--------------------------------------------------------build_images---
def build_images(path, config=CONFIG, gid_generator=hash_gid):
	'''
	Build image structures update images.json in cache.
	'''
	absolute_path = config['absolute-path']

	for name in os.listdir(path):
		fname, ext = os.path.splitext(name)

		if ext != IMAGE_EXT:
			continue

		source_path = pathjoin(path, name)

		img =  {
			'id': gid_generator(source_path),
			'name': name,
			'type': 'image',
			'state': 'single',
			'path': getpath(path, name, absolute_path),
			'ctime': os.path.getctime(source_path),
			'preview': {},
		}

		yield img


#------------------------------------------------------build_previews---
# NOTE: this will create images in the file system.
def build_previews(image, path=None, config=CONFIG, dry_run=True):
	'''

	NOTE: this needs the cache directory structure present.
	'''
	status = []
	# config...
	absolute_path = config['absolute-path']
	dirs = config['cache-structure']
	sizes = config['sizes'] 
	cache_name = config['cache-image-name']

	# data...
	gid = image['id']
	img_name = image['name']
	name = os.path.splitext(img_name)[0]
	img_path = image['path']

	if absolute_path == False:
		source_path = os.path.join(path, img_path)
	else:
		# XXX is this the best way???
		o = urllib2.urlopen(img_path)
		source_path = o.fp.name
		o.close()

	img = Image.open(source_path, 'r')

	# biggest preview is the original image...
	image['preview'][str(max(*img.size)) + 'px'] = img_path

	# previews...
	for k, spec in sizes.items():

		if k in image['preview'].keys():
			continue

		# build the two paths: relative and full...
		n = pathjoin(dirs[k], cache_name % {'guid': gid, 'name': img_name})
		p = pathjoin(path, n)

		# do not upscale images...
		if max(*img.size) <= spec:
			continue

		# add image to index...
		if not os.path.exists(p):
			scale = spec/float(max(*img.size))
			preview = img.resize((int(img.size[0]*scale), int(img.size[1]*scale)), Image.ANTIALIAS)

			if not dry_run:
				preview.save(p)
			else:
				preview.close()

			##!!! metadata???

			status += [True] 

		# image exists...
		else:
			status += [False] 

		image['preview'][str(spec) + 'px'] = getpath(path, n, absolute_path)

	return image, status


#----------------------------------------------------------build_data---
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
		report_progress=report_progress, dry_run=False):
	'''
	'''
	absolute_path = config['absolute-path']

	build_cache_dirs(path, config)

	data, images, marked = build_data(
			(report_progress(*build_previews(img, path, config, dry_run=dry_run))
				for img in build_images(path, config, gid_generator)), 
			path, config)

	images_file = config['images']
	data_file = config['data']
	marked_file = config['marked']

	data['image_file'] = getpath(path, images_file, absolute_path)

	if not dry_run:
		##!!! DO NOT OVERWRITE EXISTING DATA...
		with open(os.path.join(path, images_file), 'w') as f:
			json.dump(images, f, indent=4)
		with open(os.path.join(path, data_file), 'w') as f:
			json.dump(data, f, indent=4)
		with open(os.path.join(path, marked_file), 'w') as f:
			json.dump(marked, f, indent=4)

	return data




#-----------------------------------------------------------------------
if __name__ == '__main__':
	pass




#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :

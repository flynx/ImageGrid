#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20130521232425'''
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

config = {
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

data = {
	'version': '2.0',
	'current': None,
	'ribbons': [],
	'order': [],
	'image_file': 'images.json',
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

def pathjoin(*p):
	'''
	'''
	return ('/'.join(p)).replace('//', '/')


def log_err(path, e, source_file, target_file):
	'''
	'''
	err_file = pathjoin(path, config['error'])
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


def hash_gid(img, force=False):
	'''
	Generate gid based on preview file content.

	NOTE: img can be either a path or an Image.
	'''
	if type(img) in (str, unicode):
		img = Image.open(img)
	return sha.sha(img.tostring()).hexdigest()


def build_cache_dirs(path, config=config):
	'''
	Build cache directory tree.
	'''
	dirs = config['cache-structure']
	for _, k in dirs.items():
		p = pathjoin(path, k)
		if not os.path.exists(p):
			os.makedirs(p)


def build_images(path, config=config, gid_generator=hash_gid):
	'''
	Build image structures update images.json in cache.
	'''
	absolute_path = config['absolute-path']

	for name in os.listdir(path):
		iid, ext = os.path.splitext(name)

		if ext != IMAGE_EXT:
			continue

		source_path = pathjoin(path, name)

		img =  {
			'id': gid_generator(source_path),
			'type': 'image',
			'state': 'single',
			'path': None,
			'ctime': os.path.getctime(source_path),
			'preview': {},
		}
		if absolute_path == True:
			img['path'] = 'file:///' + urllib2.quote(pathjoin(path, name), safe='/:')
		else:
			img['path'] = urllib2.quote(name)

		yield img


def build_previews(image):
	'''
	'''



#-----------------------------------------------------------------------





#-----------------------------------------------------------------------
if __name__ == '__main__':
	pass



#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :

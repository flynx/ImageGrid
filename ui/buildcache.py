#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20120923165255'''
__copyright__ = '''(c) Alex A. Naanou 2012'''


#-----------------------------------------------------------------------

import os
import Image
import json
import sha

from pli.logictypes import OR


#-----------------------------------------------------------------------
# XXX fanatically cleanup and normalise paths...
# XXX use real uuid's...
#
# TODO:
# 	- load config from file...
# 	- accept a path on command-line
# 	- default path is cwd
# 	- support nested fav's for ribbons
#
# Long Term TODO:
# 	- support processed images
#
#
#-----------------------------------------------------------------------

config = {
	'cache-structure': {
		# XXX make these as close to standard as possible and keep
		# 	  sane distances...
		'150px': '.ImageGridCache/150px/',
		'350px': '.ImageGridCache/350px/',
		'900px': '.ImageGridCache/900px/',
		'1080px': '.ImageGridCache/1080px/',
		'1920px': '.ImageGridCache/1920px/',
	},
	'json': '.ImageGridCache/all.json',
	'error': '.ImageGridCache/error.log',
	'sizes': {
		'150px': 150,
		'350px': 350,
		'900px': 900,
		'1080px': 1080,
		'1920px': 1920,
	}
}


images = {
	'position': 0,
	'ribbons':[
		{}
	]
}


IMAGE_EXT = OR(*(
		'.jpg', '.jpeg', '.JPG', '.JPEG',
))

ERR_LOG = '''\
ERROR: %(error)s
SOURCE: %(source-file)s
TARGET: %(target-file)s


'''

CACHE_FILE_NAME = '%(guid)s - %(name)s'


#-----------------------------------------------------------------------

def log_err(path, e, source_file, target_file):
	'''
	'''
	err_file = os.path.join(path, config['error'])
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

# this should:
# 	1) see if image is cached, if yes return the cached guid (if dates match)...
# 	2) read the image file and get its guid 
##!!!
def get_image_guid(path, force=False):
	'''
	'''
	##!!! check cache and date...
	im = Image.open(path)
	return sha.sha(im.tostring()).hexdigest()
##	return sha.sha(open(path, 'r').read())


# return list of paths ending in a pattern...
def build_cache_dirs(path, config=config):
	'''
	'''
	dirs = config['cache-structure']
	for _, k in dirs.items():
		p = os.path.join(path, k)
		if not os.path.exists(p):
			os.makedirs(p)


# XXX this will not overwrite existing files...
def make_cache_images(path, config=config):
	'''
	'''
	dirs = config['cache-structure']
	sizes = config['sizes'] 
	n = 0

	for name in os.listdir(path):
		# skip non-images...
		iid, ext = os.path.splitext(name)
		if ext != IMAGE_EXT:
			continue
		n += 1
		i =  {
			'id': iid,
			'preview': {},
			'original': os.path.join(path, name),
		}
		img = Image.open(os.path.join(path, name), 'r')
		try:
			iid = sha.sha(img.tostring()).hexdigest()
		except IOError, e:
			print 'x',
			log_err(path, e, name, '-')
			continue
		finally:
			images['ribbons'][0][iid] = i
		# add original image to struct...
		i['preview'][str(max(*img.size)) + 'px'] = os.path.join(path, name)
		# previews...
		for k, spec in sizes.items():
			p = os.path.join(path, dirs[k], CACHE_FILE_NAME % {'guid': iid, 'name': name})
			# do not upscale images...
			if max(*img.size) <= spec:
				continue
			# add image to index...
			if not os.path.exists(p):
				scale = spec/float(max(*img.size))
				preview = img.resize((int(img.size[0]*scale), int(img.size[1]*scale)), Image.ANTIALIAS)
				preview.save(p)
				##!!! metadata???
				##!!!
				print '.',
			else:
				# indicate an image skip...
				print '_',
			i['preview'][str(spec) + 'px'] = p
		# put original image in cache...
		i['preview'][str(spec) + 'px'] = p
	images['position'] = images['ribbons'][0].keys()[0]
	with open(os.path.join(path, config['json']), 'w') as f:
		json.dump(images, f, indent=4)
	##!!! STUB...
	return n



#-----------------------------------------------------------------------
if __name__ == '__main__':
##	PATH = 'images/cache-test/'
	PATH = 'L:/incoming/UNSORTED/Images/fav'

	import time

	t0 = time.time()

	build_cache_dirs(PATH)

	n = make_cache_images(PATH)

	t1 = time.time()

	print
	print 'Processed %s images in %s seconds.' % (n, t1-t0)



#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :

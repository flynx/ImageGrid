#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20130326030151'''
__copyright__ = '''(c) Alex A. Naanou 2011'''


#-----------------------------------------------------------------------
# The first index.py might be a little too complicated. try and resolve
# this as so:
# 	- list all relevant files (RAW, XMP, JPG, PSD, ...)
# 	- group by path (closeness)
# 		- deepest common path to contain all files with common name.
# 		  this will fail if we have different files with same names.
#
#-----------------------------------------------------------------------

import os
import json
import zipfile
import uuid
import time
from pprint import pprint
from itertools import izip, izip_longest

import pyexiv2 as metadata
import couchdb

from pli.logictypes import ANY, OR

import store
from gid import image_gid


#-----------------------------------------------------------------------

##CONFIG_NAME = 'hdd9_config.json'
CONFIG_NAME = 'P7000_config.json'
##CONFIG_NAME = 'staging_config.json'

config = json.load(open(CONFIG_NAME))

# XXX move this to a context-dependant module...
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

JPEG = OR(
	'JPG', 'jpg', 
	'JPEG', 'jpeg',
)

PSD = OR(
	'PSD', 'psd'
)

TIFF = OR(
	'TIFF', 'tiff', 
	'TIF', 'tif'
)

XMP = OR(
	'XMP', 'xmp'
)

ITEM = OR(RAW, JPEG, PSD, TIFF, XMP)

TYPES = {
	'raw': RAW,
	'jpeg': JPEG,
	'psd': PSD,
	'tiff': TIFF,
	'xmp': XMP,
}

SKIP_DIRS = '.sys2'
SKIP_MARKER = '.skipindexing'


SUBTREE_CLASSES = {
	'preview': 'preview', 
	'preview (RAW)': 'RAW preview', 
}


#-----------------------------------------------------------------------



#----------------------------------------------------------list_files---
##!!! we will need to normalize the paths to one single scheme (either relative or absolute)...
# XXX might need to fetch file data too...
def list_files(root, sub_trees=SUBTREE_CLASSES, type=ITEM, 
		include_root_path=False, include_ctime=True, 
		skip_marker=SKIP_MARKER, skip_dirs=SKIP_DIRS):
	'''
	yields:
		(<path>, <name>, <ext>[, <ctime>]),
	'''
	for orig_path, dirs, files in os.walk(root):
		# skip dir trees containing skip_filename...
		if skip_marker in files:
			del dirs[:]
			continue
		# skip dirs...
		while skip_dirs in dirs:
			dirs.remove(skip_dirs)

		# XXX is this correct...
		path = orig_path.split(os.path.sep)
		# remove root from path...
		if not include_root_path:
			path = path[len(root.split(os.path.sep)):]
		# process files...
		for f in files:
			name, ext = os.path.splitext(f)
			# we need the extension wothout the dot...
			ext = ext[1:]
			# filter by ext...
			if ext == type:
				if include_ctime:
					t = os.path.getctime(os.path.join(orig_path, f))
					yield path, name, ext, t
				else:
					yield path, name, ext


#----------------------------------------------------------common_len---
def common_len(a, *b):
	'''
	calculate the common path length.
	'''
	for i, l in enumerate(izip(*(a,) + b)):
		if len(set(l)) != 1:
			return i
	return len(min(*(a,) + b))


#-------------------------------------------------------path_distance---
##!!! is this meaningless?
def path_distance(a, b):
	'''
	'''
	return len(a) + len(b) - common_len(a, b)*2


#-------------------------------------------------------index_by_name---
def index_by_name(lst):
	'''
	index by file name (indexing preparation)...

	format:
	{
		<name> : [
			(<path>, <name>, ...),
			...
		],
		...
	}
	'''
	res = {}
	# NOTE: this is to avoid side-effects...
	lst = lst[:]
	# sort via name, ext, path
	lst.sort(key=lambda e: (e[1], e[2], e[0]))
	for e in lst:
		n = e[1]
		if n in res:
			res[n] += [e]
		else:
			res[n] = [e]
	return res



#-------------------------------------------------------split_by_raws---
def split_by_raws(raws, lst, failed):
	'''
	'''
##	raws = [e for e in lst if e[2] == RAW] 
	# top level common path...
	common = common_len(*[ e[0] for e in raws ])

	# NOTE: do not change the order of raws after this point
	# 		and till the end of the loop...
	# 		XXX revise if there is a simpler way...
	sets = [ [r, [r]] for r in raws ]

	for e in lst:
		if e[2] == RAW:
			continue
		# check if we are closer to other raws...
		# NOTE: this depends on stability of order in raws
		c_index = [(common_len(r[0], e[0]), r, i) for i, r in enumerate(raws)]
		c, raw, i = max(*c_index)
		# we have two locations with identical weight...
		if c_index.count([c, ANY, ANY]) > 1:
			# a file is at a path junction exactly...
			print '    !!! can\'t decide where to put %s.%s...' % (e[1], e[2])
			##!!! try different strategies here...
			##!!!
			failed += [e]
		# found a location...
		elif c > common:
			sets[i][1] += [e]
		# file in an odd location ##!!! list these locations...
		else:
			print '    !!! can\'t decide where to put %s.%s...' % (e[1], e[2])
			##!!! try different strategies here...
			##!!!
			failed += [e]
	return sets


#-----------------------------------------------------------gid_index---
##!!! this will rewrite existing data -- should only update...
def gid_index(index, existing=None):
	'''
	'''
	skipped = []
	# index via a propper GID...
	# split similarly named but different files...
	if existing is None:
		res = {}
	else:
		res = existing
	failed = []
	im_n = 0
	up_n = 0
	new_n = 0

	for name, l in index.iteritems():
		l.sort()
		raws = [e for e in l if e[2] == RAW] 

		# multiple raw files...
		if len(raws) > 1:
			sets = split_by_raws(raws, l, failed)
		# single raw...
		elif len(raws) == 1:
			sets = [(raws[0], l)]
		# no raw files...
		else:
			print (' '*78), '\rno raw file found for "%s"...' % os.path.join(name)
			sets = []
			##!!! need to report this in a usable way...
			failed += l

		# add actual elements to index...
		for raw, l in sets:
			im_n += 1
			print 'Processing image:', im_n, 'new:', new_n, 'updated:', up_n, '\r',

			# get file GID...
			GID = image_gid('%s.%s' % (os.path.join(*[config['ARCHIVE_ROOT']] + raw[0] + [raw[1]]), raw[2]))

			##!!! normalize the image format...
			img = {
				'gid': GID,
				'name': name,
				'imported': time.time(),
				'updated': time.time(),
				# NOTE: this might get distorted on archiving or
				# 		copying...
				# 		mostly intended for importing...
				'ctime': raw[3], 
				##!!! make these more general...
				'RAW': [e for e in l if e[2] == RAW],
				'XMP': [e for e in l if e[2] == XMP],
				'JPG': [e for e in l if e[2] == JPEG],
				'PSD': [e for e in l if e[2] == PSD],
				'TIFF': [e for e in l if e[2] == TIFF],
				'other': [e for e in l if e[2] != OR(TIFF, PSD, JPEG, XMP, RAW)],
			}
			# add new data...
			if GID not in res:
				res[GID] = img
				new_n += 1
			# update existing...
			else:
				cur = res[GID]
				updating = False
				for k, v in img.iteritems():
					# skip 
					if k in ('imported', 'name', 'gid', 'ctime', 'updated'):
						continue
					if v != cur[k]:
						cur[k] = v
						updating = True
				# do the actual update...
				if updating:
					cur['updated'] = time.time()
					res[GID] = cur
					up_n += 1
				else:
					skipped += [GID]

	return res, failed, skipped



#-----------------------------------------------------------------------
if __name__ == '__main__':

	INDEX_PATH = config.get('INDEX_ROOT', os.path.join('test', 'index2'))

	FILE_LIST = os.path.join('test', 'flatfilelist-P7000-new.json')
##	FILE_LIST = os.path.join('test', 'flatfilelist-120kfiles.json')
##	FILE_LIST = os.path.join('test', 'flatfilelist.json')
	BUILD_FILE_LIST = False if os.path.exists(FILE_LIST) else True


	if BUILD_FILE_LIST:
		lst = list(list_files(config['ARCHIVE_ROOT']))
	
		print 'found files:', len(lst)
##		pprint(lst[0])
	
		json.dump(lst, file(FILE_LIST, 'w'))
		print 'saved...'

	lst = json.load(file(FILE_LIST))
	print 'loaded:', len(lst)


	IMPORT_DIFF = False

	# skip already read files...
	if IMPORT_DIFF and not BUILD_FILE_LIST:
		lst_cur = list(list_files(config['ARCHIVE_ROOT']))

		print 'found files:', len(lst_cur)

		lst_cur = [ e for e in lst_cur if e not in lst ]

		print 'found new or updated files:', len(lst_cur)

		lst = lst_cur

		raise SystemExit



	index = index_by_name(lst)


##	GID_index = store.IndexWithCache(INDEX_PATH)
	GID_index = store.Index(INDEX_PATH)

	# a cheating waw to say if we are empty...
	index_empty = True
	for k in GID_index.iterkeys():
		index_empty = False
		break

	t0 = time.time()

	if not index_empty:
		print 'updating...'
		##!!! this takes a substantially longer time initially... (about 30x longer)
		GID_index, failed, skipped = gid_index(index, GID_index)
	else:
		print 'indexing...'
		GID_index, failed, skipped = gid_index(index)
		store.dump(GID_index, INDEX_PATH, index_depth=2)

	t1 = time.time()

	print 'done in:', t1-t0, 'seconds.'

	json.dump(failed, file(os.path.join('test', 'failed-to-categorise.json'), 'w'))



	##!!! TODO: archive descriptions to help index/tag items...

	# NOTE: each import from an existing archive will be as follows:
	# 			- full listing
	# 			- find new subtrees
	# 			- find modified items (file date diff)
	
	# NOTE: raws number here may be more than indexed because some raws 
	# 		may get grouped by GID
	print '''results:
	indexed: %s
	raws: %s
	failed: %s
	skipped: %s
	''' % (
			len(GID_index), 
			len([ e for e in lst if e[2] == RAW]), 
			len(failed),
			len(skipped))

##	##!!! this is really slow because it pulls ALL the data... wonder who wrote this? :)
##	pprint(GID_index.itervalues().next())

##	store.dump(GID_index, INDEX_PATH)

##	store.pack(INDEX_PATH)




#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :

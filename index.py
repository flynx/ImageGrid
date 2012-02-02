#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20120202150737'''
__copyright__ = '''(c) Alex A. Naanou 2011'''


#-----------------------------------------------------------------------

import os
import json
import zipfile
import uuid

from itertools import izip, izip_longest

from pli.logictypes import ANY, OR

from pprint import pprint


#-----------------------------------------------------------------------

CONFIG_NAME = 'test_config.json'
##CONFIG_NAME = 'tmp_config.json'

config = json.load(open(CONFIG_NAME))

RAW = OR(
	'NEF', 'nef', 
	'CRW', 'crw',
	'CR2', 'cr2',
	'X3F', 'x3f'
)

JPEG = OR(
	'JPG', 'jpg', 
	'JPEG', 'jpeg'
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


SUBTREE_CLASSES = {
	'preview': 'preview', 
	'preview (RAW)': 'RAW preview', 
}


#-----------------------------------------------------------------------

##!!! we will need to normalize the paths to one single scheme (either relative or absolute)...
def list_files(root, sub_trees=SUBTREE_CLASSES, type=ITEM):
	'''
	'''
	for path, dirs, files in os.walk(root):
		path = path.split(os.path.sep)
		# process files...
		for f in files:
			name, ext = os.path.splitext(f)
			# we need the extension wothout the dot...
			ext = ext[1:]
			# filter by ext...
			if ext == type:
				yield path, name, ext


# XXX need to split duplicate named raw files and corresponding
# 	  previews...
def index_by_name(file_list, types=TYPES.items()):
	'''
	format:
		{
			<name>: {
				<type>: [
					(<path>, <orig-ext>),
					...
				],
				...
			},
			...
		}
	'''
	res = {}
	for path, name, ext in file_list:
		# normalize extension...
		orig_ext, ext = ext, types[types.index((ANY, ext))][0]
		if name not in res:
			# create a name...
			res[name] = {}
		if ext not in res[name]:
			# create an extension...
			res[name][ext] = []
		# general case...
		res[name][ext] += [(path, orig_ext)]
	return res


# for this to work correctly it must:
# 	- return unique paths
# 	- non of the returnd paths can be a strict subset of any other...
##!!!
def split_common(paths):
	'''
	build a common path tree...
	'''
	# pass 1: build list of common paths (None for all differences)
	# NOTE: we may have stray common path elements but we do
	# 		not care abut anything after a None...
	index = izip_longest(*paths)
	common = []
	for s in index:
		next = []
		for i in s:
			if s.count(i) > 1:
				next += [i]
			else:
				next += [None]
		common += [next]
	# pass 2: cap each common section with a unique element...
	common = [ list(e) for e in izip(*common)]
	for c, p in izip(common, paths):
		if None in c:
			i = c.index(None)
			if len(p) <= i:
				# NOTE: this is the case when we have a None 
				# 		because a path just ended... i.e. there 
				# 		was no different element to split at...
				# XXX do we need to break here?
				# XXX one way to go here is to simply ignore
				# 	  such paths...
				del c[i]
				continue
			# in-place update and truncate the common path...
			c[i] = p[i]
			del c[i+1:]
	return common

# in essance this need to replace image name with a GID and split up
# images that are identically named into seporate GIDs...
def split_images(index):
	'''
	This will split groups that contain multiple raw files.

	Groups are split to contain one raw each.

	Each image will be grouped to the raw that contains the largest 
	matching sub-path, starting from root.

	Resulting groups will have a gid as it's key

	This will fail for any files that live in a common sub-path of any
	two or more raw files.


	NOTE: in the case there are two raw files in one path, then we will 
		  favor the deeper / longer mathch.
	'''
	for name, data in index.items():
		# this will not let us lose the name of the image...
		data['name'] = name
		raw = data.get('raw', [])
		if len(raw) > 1:
			common = split_common([r for r, e in raw])
			# prepare the return structure...
			res = []
			for path in raw:
				res += [{
					'gid': str(uuid.uuid4()),
					'name': name,
					'raw': [path],
				}]
			# start splitting the data...
			for t, paths in data.items():
				# skip non-type fields...
				if t not in TYPES:
					continue
				if t == 'raw':
					continue
				# start the work...
				for path, ext in paths:
					matches = []
					for i, c in enumerate(common):
						# use matching path head to match targets...
						if path[:len(c)] == c:
							matches += [(len(c), i)]
					# multiple matches...
					if len(matches) > 1:
						# longest match wins...
						matches.sort(key=lambda e: e[0])
						if matches[0][0] == matches[1][0]:
							# XXX we could try and use a different
							# 	  strategy...
							##!!! do a better error...
							raise Exception, 'got two targets with same score, can\'t decide where to put the file.'
						del matches[1:]
					if len(matches) == 1:
						i = matches[0][1]
						# we found a location...
						if t not in res[i]:
							res[i][t] = []
						res[i][t] += [(path, ext)]
					else:
						##!!! we sometimes fall into here for odd reasons (use tmp_config.json)
						# output orphan/ungrouped images...
						# NOTE: these images can be located in a
						# 		different place or are orgonized in a
						# 		different way...
						print '%%%%%%', path, name, ext
						gid = str(uuid.uuid4())
						yield gid, {
							'gid': gid,
							'name': name,
							t: [(path, ext)],
						} 

			# yield the results...
			for e in res:
				yield e['gid'], e
		else:
			gid = data['gid'] = str(uuid.uuid4())
			yield gid, data



#-----------------------------------------------------------------------
# XXX is this a good way to serialize the actual data in the fs???

# NOTE: these will work with any topoloy and create a flat index...
def save_file_index(index, path, index_depth=1, ext='.json'):
	'''

	NOTE: index_depth with value greater than 2 is an overkill.
	'''
	root_index = {}
	for k, v in index.items():
		if index_depth > 0:
			d = []
			rest = k
			# build index path...
			for i in xrange(index_depth):
				d += [rest[:2]]
				rest = rest[2:]
				# recursive directory construction...
				if not os.path.exists(os.path.join(path, *d)):
					os.mkdir(os.path.join(path, *d))
			p = os.path.join(path, *d + [k + ext])
		else:
			p = os.path.join(path, k + ext)
		json.dump(v, file(p, 'w'), indent=4, separators=(', ', ': '))
		root_index[k] = p
##		print '.',
	return root_index


def load_file_index(path, ext='.json', pack_ext='.pack'):
	'''
	'''
	d = {}
	for p, _, files in os.walk(path):
		for f in files:
			# handle single files...
			if f.endswith(ext):
				d[os.path.splitext(f)[0]] = json.load(file(os.path.join(p, f)))
			# handle packs...
			elif f.endswith(pack_ext):
				pack = zipfile.ZipFile(os.path.join(p, f))
				# load elements form the pack...
				for name in pack.namelist():
					if name.endswith(ext):
						d[os.path.splitext(name)[0]] = json.loads(pack.read(name))
	return d


# XXX should we remove empty dirs here???
def pack_file_index(path, ext='.json', pack_ext='.pack', keep_files=False, keep_dirs=False):
	'''

	NOTE: if keep_files is True, keep_dirs option will be ignored.
	'''
	z = zipfile.ZipFile(os.path.join(path, 'index' + pack_ext), 'a', compression=zipfile.ZIP_DEFLATED)
	for p, _, files in os.walk(path):
		for f in files: 
			if f.endswith(ext):
				z.write(os.path.join(p, f), os.path.split(f)[-1])
				if not keep_files:
					os.remove(os.path.join(p, f))
					# XXX this will not remove empty dirs (push one
					#     level up for that...)
					if not keep_dirs and p != path:
						##!!! check if dir is empty....
						try:
							# NOTE: this will fail for non-empty dirs...
							os.rmdir(os.path.join(p))
						except:
							pass
	z.close()
	
##!!! get path by name helper...
##!!!


#-----------------------------------------------------------------------
# lazy dict-like objects that read and write (optional) the fs...

import pli.pattern.mixin.mapping as mapping
import pli.objutils as objutils

# XXX might be good to do a path index...
##!!! make this archive/file structure-agnostic...
class Index(mapping.Mapping):
	__json_ext__ = '.json'
	__pack_ext__ = '.pack'

	def __init__(self, path):
		'''
		'''
		self._path = path
	
	# specific interface...
	##!!! make this support different depths...
	def __locations__(self, name):
		'''
		'''
		ext = self.__json_ext__
		name += ext
		# build probable locations...
		return (
				name,
				# look in a directory...
				os.path.join(name[:2], name),
				##!!! HACK: make this dynamic...
				os.path.join(name[:2], name[2:4], name),
		)
	
	# mapping interface...
	def __getitem__(self, name):
		'''
		'''
##		ext = self.__json_ext__
		pack_ext = self.__pack_ext__
##		file_name = name + ext
		locations = self.__locations__(name)
		# look of the file directly...
		for n in locations:
			if os.path.exists(os.path.join(self._path, n)):
				return json.load(file(os.path.join(self._path, n)))
		# try and locate a file in a pack...
		for p, _, files in os.walk(self._path):
			# files are searched sorted by their name...
			files.sort()
			for f in files:
##				##!!! do we need to look in odd named directories...
##				if f == file_name:
##					return json.load(file(os.path.join(p, file_name)))
				if f.endswith(pack_ext):
					z = zipfile.ZipFile(os.path.join(p, f))
					for n in locations:
						if n in z.namelist():
							return json.loads(z.read(n))
		raise KeyError, name
	def __setitem__(self, name, value):
		'''
		'''
		raise NotImplementedError
	def __delitem__(self, name):
		'''
		'''
		raise NotImplementedError
	def __iter__(self):
		'''
		'''
		visited = []
		packs = []
		ext = self.__json_ext__
		pack_ext = self.__pack_ext__
		for p, _, files in os.walk(self._path):
			for f in files:
				if f.endswith(ext) and f not in visited:
					visited += [f]
					yield os.path.splitext(f)[0]
				elif f.endswith(pack_ext):
					packs += [os.path.join(p, f)]
		for pack in packs:
			z = zipfile.ZipFile(pack)
			for name in z.namelist():
				if name not in visited:
					visited += [name]
					yield os.path.splitext(name)[0]


REMOVED = object()

class IndexWithCache(Index):
	'''
	'''
	objutils.createonaccess('_cache', dict)

	__sync__ = False

	def __getitem__(self, name):
		'''
		'''
		if name in self._cache:
			res = self._cache[name]
			if res is REMOVED:
				raise KeyError, name
			return res
		res = self._cache[name] = super(IndexWithCache, self).__getitem__(name)
		return res
	def __setitem__(self, name, value):
		'''
		'''
		self._cache[name] = value
		if self.__sync__:
			self.cache_flush(name)
	##!!!
	def __delitem__(self, name):
		'''
		'''
		self._cache[name] = REMOVED
		if self.__sync__:
			self.cache_flush(name)
	def __iter__(self):
		'''
		'''
		cache = self._cache
		for e in cache:
			yield e
		for e in super(IndexWithCache, self).__iter__():
			if e not in cache:
				yield e
	
	# cache management...
	##!!! removed items will not get flushed yet...
	# XXX to make removing elements history compatible, one way to go
	#     is to write a specifc value to the file, thus making it
	#     shadow the original value...
	def cache_flush(self, *keys):
		'''
		'''
		if keys == ():
			return save_file_index(self._cache, self._path)
		flush = {}
		for k in keys:
			if k is REMOVED:
				# remove file...
##				raise NotImplementedError
				##!!!
				continue
			flush[k] = self[k]
		return save_file_index(flush, self._path)
	def cache_drop(self):
		'''
		'''
		del self._cache



#-----------------------------------------------------------------------
##!!! test implementation: rewrite...
import pyexiv2 as metadata
import shutil
import Image

def build_image_cache(ic, min_rating, dest, tmp_path, preview_size=900):
	# build preview cache for 5* images...
	for k, e in ic.items():
		name = e.get('name', None)
		xmps = e.get('xmp', None)
		jpegs = e.get('jpeg', None)
		raws = e.get('raw', None)

		##!!! get tmp dir...
		##!!!

		res = {
			'missing preview': [],
			'missing raw': [],
			'unrated': [],
		}

		if xmps is not None:
			##!!! avoid manual path forming....
			xmp_path = xmps[0][0][0] + '\\' + os.path.join(*(xmps[0][0][1:] + [name])) + '.' + xmps[0][1]
			# get rating...
			im = metadata.ImageMetadata(xmp_path)
			im.read()
			rating = im['Xmp.xmp.Rating'].value
			##!!! cache the rating...
			e['Rating'] = rating
			ic[k] = e
			if rating >= min_rating:
				# get the jpeg...
				if jpegs is None:
					if raws is None:
##						print '### can\'t find raws for %s' % name
						res['missing raw'] += [k]
						continue
					raw_path = raws[0][0][0] + '\\' + os.path.join(*(raws[0][0][1:] + [name])) + '.' + raws[0][1]
##					print '>> missing preview %s.jpg' % name
					res['missing preview'] += [raw_path]
					##!!! generate jpegs...
					raw = metadata.ImageMetadata(raw_path)
					raw.read()

					for i, p in enumerate(raw.previews):
						if max(p.dimensions) >= preview_size:
							# extract preview...
							tmp_preview_path = os.path.join(tmp_path, '%s-%s%s' % (name, i, p.extension))
							open(tmp_preview_path, 'wb').write(p.data)
							# resize preview...
							orig = Image.open(tmp_preview_path)
							scale = preview_size/float(max(*orig.size))
							print 'generating preview...'
							preview = orig.resize((int(orig.size[0]*scale), int(orig.size[1]*scale)), Image.ANTIALIAS)
							# save preview...
							print 'saving preview: %s' % name
							preview_path = os.path.join(dest, k + '-' + name + '.jpg')
							preview.save(preview_path)
							# copy metadata...
							##!!! need to write metadata to all previews...
							preview_metadata = metadata.ImageMetadata(preview_path)
							preview_metadata.read()
							raw.copy(preview_metadata)
							preview_metadata.write()
				else:
					jpg_path = jpegs[0][0][0] + '\\' + os.path.join(*(jpegs[0][0][1:] + [name])) + '.' + jpegs[0][1]
					# copy the jpeg to the cache...
					print '>>> copy: %s.jpg' % name
					##!!! HACK: manual name generation...
					##!!! use a good id, like a timestamp...
					shutil.copy2(jpg_path, os.path.join(dest, k + '-' + name + '.jpg'))
		else:
			##!!! need to detect unrated shoots...
##			print '>> no XMP'
			res['unrated'] += [k]
			continue

	ic.cache_flush()
	pack_file_index(ic._path, keep_files=False)

	return res



#-----------------------------------------------------------------------
if __name__ == '__main__':
	lst = list(list_files(config['ARCHIVE_ROOT']))

	print len(lst)

	index = index_by_name(list_files(config['ARCHIVE_ROOT']))

	print len(index)

	index = list(split_images(index_by_name(list_files(config['ARCHIVE_ROOT']))))

	l = len(index)

	index = dict(index)

	print l, len(index)

	json.dump(index, file(os.path.join('test', 'filelist.json'), 'w'))



	root_index = save_file_index(index, os.path.join('test', 'index'), index_depth=1)

##	##!!! this is not used in anything yet...
##	json.dump(root_index, file(os.path.join('test', 'index', 'file_index.json'), 'w'))

	pack_file_index(os.path.join('test', 'index'), keep_files=False)

	d = load_file_index(os.path.join('test', 'index'))


	print len(d)

	k = d.keys()[0]

	i = Index(os.path.join('test', 'index'))

	print len(i)

##	print i[k]

	ic = IndexWithCache(os.path.join('test', 'index'))

	print ic[k]

	ic['000000000000000000000000000000000'] = {}

	ic.cache_flush()

	pack_file_index(ic._path, keep_files=False)

	ic.__sync__ = True

	ic['111111111111111111111111111111111'] = {}

	pack_file_index(ic._path, keep_files=False)


	##!!! revise...
	res = build_image_cache(ic, 5, os.path.join('test', 'index', 'cache'), os.path.join('test', 'tmp'))


	os.remove(os.path.join('test', 'index', 'index.pack'))


	TEST_20K_ITEMS = False

	if TEST_20K_ITEMS:
		print 'doing a 20k test...'

		print 'loading...'
		full = dict(json.load(file(os.path.join('test', 'filelist of 20k files.json'))))

		print 'writing files...'
		root_index = save_file_index(full, os.path.join('test', 'index'), index_depth=1)

		print 'packing files...'
		# NOTE: the initial archiving seems REALLY SLOW, but working with
		# 		small numbers of files from the archive seems adequate...
		pack_file_index(os.path.join('test', 'index'), keep_files=True)




#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :

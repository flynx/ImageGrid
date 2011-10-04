#=======================================================================

__version__ = '''0.0.01'''
__sub_version__ = '''20111004190928'''
__copyright__ = '''(c) Alex A. Naanou 2011'''


#-----------------------------------------------------------------------

import uuid
import pli.objutils as objutils
import pli.pattern.proxy.utils as putils


#-----------------------------------------------------------------------
#------------------------------------------------------AbstractTagSet---
class AbstractTagSet(object):
	'''
	'''
	pass


#---------------------------------------------------------BasicTagSet---
class BasicTagSet(AbstractTagSet):
	'''
	'''
	objutils.createonaccess('_index', dict)

	def tag(self, obj, *tags):
		'''
		'''
		index = self._index
		for tag in tags:
			if tag not in index:
				index[tag] = set()
			index[tag].add(obj)
		return self
	def untag(self, obj, *tags):
		'''
		'''
		index = self._index
		for tag in tags:
			index[tag].remove(obj)
		return self
	
	# selectors...
	def all(self, *tags):
		'''
		'''
		index = self._index
		pool = []
		for tag in tags:
			pool += [index[tag]]
		pool.sort(key=len)
		# if we have atleast one empty set then we have an empty
		# result...
		if len(pool[0]) == 0:
			return set()
		# initially get the largest pool element... 
		# NOTE: this is an optimization -- we first intersect the
		# 		largest population with the smallest, giving the rest a
		# 		far smaller population to work with...
		res = set(pool.pop(-1))
		# now we get the total intersection of elements...
		for s in pool:
			res.intersection_update(s)
		return res
	def any(self, *tags):
		'''
		'''
		index = self._index
		res = set()
		for tag in tags:
			res.update(index[tag])
		return res
	##!!! slow !!!##
	def none(self, *tags):
		'''
		'''
		# XXX is this the best way yo do this?
		index = self._index
		bad = self.any(*tags)
		other_tags = set(index.keys()).difference(tags)
		return self.any(*other_tags).difference(bad)


#-----------------------------------------TagSetWithReverseIndexMixin---
class TagSetWithReverseIndexMixin(AbstractTagSet):
	'''
	'''
	objutils.createonaccess('_reverse_index', '_build_reverse_index', local_attr_tpl='%s_data')

	##!!! slow !!!##
	def _build_reverse_index(self):
		'''
		'''
		res = {}
		index = self._index
		# XXX this is really ugly!!
		objects = reduce(set.union, index.values())
		for obj in objects:
			res[obj] = set(t for t in index if obj in index[t])
		return res
	def _reset_reverse_index(self):
		if hasattr(self, '_reverse_index_data'):
			del self._reverse_index_data
		self._reverse_index_data
	
	# these need to update the cache (_reverse_index)
	def tag(self, obj, *tags):
		'''
		'''
		super(TagSetWithReverseIndexMixin, self).tag(obj, *tags)
		# update cache...
		if obj not in self._reverse_index:
			self._reverse_index[obj] = set()
		self._reverse_index[obj].update(tags)
		return self
	def untag(self, obj, *tags):
		'''
		'''
		super(TagSetWithReverseIndexMixin, self).untag(obj, *tags)
		# update cache...
		if obj in self._reverse_index:
			self._reverse_index[obj].difference_update(tags)
			if len(self._reverse_index[obj]) == 0:
				del self._reverse_index[obj]
		return self
	
	# specific interface...
	def tags(self, *objs):
		'''
		return a list of all the tags that tag the given objects.

		if no objects are given return all the tags.
		'''
		if objs == ():
			return set(self._index.keys())
		res = set()
		rev_index = self._reverse_index
		for obj in objs:
			res.update(rev_index[obj])
		return res
	def objects(self):
		return self._reverse_index.keys()



#------------------------------------------TagSetWithRelatedTagsMixin---
class TagSetWithRelatedTagsMixin(AbstractTagSet):
	'''

	NOTE: this requires the .tags(...) method.
	'''
	##!!! should be two modes: strict (all) and non-strict (any)...
	def relatedtags(self, *tags):
		'''
		'''
		return self.tags(*self.all(*tags)).difference(tags)
		

#--------------------------------------------------------------TagSet---
class TagSet(TagSetWithRelatedTagsMixin, TagSetWithReverseIndexMixin, BasicTagSet):
	'''
	'''
	pass
		


#-----------------------------------------------------------------------
#-----------------------------------------------TagSetWithObjectIndex---
class TagSetWithObjectIndex(object):
	'''
	'''
	objutils.createonaccess('_index', TagSet)
	objutils.createonaccess('_objects', dict)
	objutils.createonaccess('_cache', '_build_cache', local_attr_tpl='%s_data')

	# internal interface...
	def _build_cache(self):
		return dict(((b, a) for a, b in self._objects.items()))
	def _reset_cache(self):
		if hasattr(self, '_cache_data'):
			del self._cache_data
		self._cache_data
	
	# these need to manupulate the cache...
	def tag(self, obj, *tags):
		'''
		'''
		uid = self._cache.get(obj, uuid.uuid1())
		self._index.tag(uid, *tags)
		if uid not in self._objects:
			self._objects[uid] = obj
			self._cache[obj] = uid
		return self
	def untag(self, obj, *tags):
		uid = self._cache[obj]
		self._index.untag(uid, *tags)
		# update cache...
		if uid not in self._index.objects():
			del self._objects[uid]
		return self

	def _proxy_op(name):
		def _op(self, *tags):
			'''
			'''
			return set(self._objects[uid] for uid in getattr(self._index, name)(*tags))
		return _op
	all = _proxy_op('all')
	any = _proxy_op('any')
	none = _proxy_op('none')
	del _proxy_op

	def tags(self, *objs):
		'''
		'''
		cache = self._cache
		return self._index.tags(*(cache[obj] for obj in objs))
	def objects(self):
		return self._objects.values()
	def getuid(self, obj):
		'''
		'''
		return self._cache.get(obj, None)
	


#-----------------------------------------------------------------------
if __name__ == '__main__':
	pass

	from time import time
	import cPickle as pickle

	ts = TagSet()
##	ts = TagSetWithObjectIndex()


##	N = 100000
	N = 1000
	obj_tpl = 'image%010d'

	def populate_tagset():
		for i in xrange(N):
			n = obj_tpl % i
			ts.tag(n, 'image')
			if n.endswith('0'):
				ts.tag(n, '0')
			if n.endswith('5'):
				ts.tag(n, '5')
			if n.endswith('10'):
				ts.tag(n, '10')

	def save_tagset():
		pickle.dump(ts, open('tags.db', 'w'))

	def load_tagset():
		print 'loading tagset...',
		t0 = time()
		ts = pickle.load(open('tags.db'))
		t1 = time()
		print 'done (%.3fs).' % (t1-t0)
		return ts


##	populate_tagset()
	ts = load_tagset()

	print len(ts.tags())
	print len(ts.objects())
	print len(ts.all('10'))
	print len(ts.all('10', '0'))
	print len(ts.any('10', '5'))
	print len(ts.none('10', '5'))

	print ts.tags(obj_tpl % 0)
	print ts.tags(obj_tpl % 10)

	print ts.relatedtags('image')
	print ts.relatedtags('image', '0')
	print ts.relatedtags('10')


	print 'selecting (all)...',
	t0 = time()
	ts.all('10', '0')
	t1 = time()
	print 'done (%.3fs).' % (t1-t0)
	print 'selecting (any)...',
	t0 = time()
	ts.any('10', '5')
	t1 = time()
	print 'done (%.3fs).' % (t1-t0)
	print 'selecting (none)...',
	t0 = time()
	ts.none('10', '5')
	t1 = time()
	print 'done (%.3fs).' % (t1-t0)

	print 'getting object tags...',
	t0 = time()
	res = ts.tags(obj_tpl % 10)
	t1 = time()
	print 'done (%.3fs).' % (t1-t0)




#=======================================================================
#                                            vim:set ts=4 sw=4 nowrap :

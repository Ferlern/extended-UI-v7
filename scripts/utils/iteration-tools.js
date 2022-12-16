exports.iterateSeq = function (func, seqIterator) {
    while ( seqIterator.hasNext() ) {
        func(seqIterator.next());
    }
}

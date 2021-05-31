let test = require('tap').test;
let fromDot = require('ngraph.fromdot');
let generate = require('ngraph.generators');
let {maybeIsomorphic, getGraphWLCosineSimilarity, getGraphWLJaccardSimilarity} = require('..');
let generator = require('ngraph.generators');

test('it gives no for non-isomorphic graphs', t => {
  let a = fromDot(`graph A {
    A -> B;
    B -> C;
    C -> A;
  }`)

  let b = fromDot(`graph B {
    A -> B;
    B -> C;
  }`)

  t.equal(maybeIsomorphic(a, b), false, 'Graphs are not isomorphic');
  t.end();
})

test('it gives yes for maybe isomorphic graphs', t => {
  let a = fromDot(`graph A {
    A -> B;
    B -> C;
    C -> A;
  }`)

  let b = fromDot(`graph B {
    Foo -> Bar;
    Bar -> Baz;
    Baz -> Foo;
  }`);
  t.equal(maybeIsomorphic(a, b), true, 'Graphs are isomorphic');
  t.end();
});

test('it gives yes for maybe isomorphic graphs case 2', t => {
  let a = fromDot(`graph A {
    top -> right;
    top -> middle;
    top -> bottom;
    right -> right_bottom;
    right_bottom -> bottom;
    middle -> bottom;
  }`)

  let b = fromDot(`graph B {
    fee -> far;
    fee -> bar;
    fee -> baz;
    baz -> bar;
    baz -> bop;
    bop -> far;
  }`);
  t.equal(maybeIsomorphic(a, b), true, 'Graphs are isomorphic');
  t.end();
});

test('it gives yes for maybe isomorphic graphs from generators library', t => {
  let a = generator.grid(10, 10);
  let b = generator.grid(10, 10);

  t.equal(maybeIsomorphic(a, b), true, 'Graphs are isomorphic');
  t.end();
});

test('it can compute cosine similarity', t => {
  let a = fromDot(`
graph A {
  a -> {b; c; d};
  b -> c;
  d -> {c; e; f};
}`);

  let b = fromDot(`
graph A {
  a -> {b; c};
  b -> {c; d};
  d -> {e; c};
  c -> f;
}`);
  let res = getGraphWLCosineSimilarity(a, b, 2);
  t.equal(res, 0.7826237921249264, 'Kernel is as expected');
  res = getGraphWLCosineSimilarity(b, a, 2);
  t.equal(res, 0.7826237921249264, 'Conjugate kernel is as expected');
  res = getGraphWLCosineSimilarity(b, b, 2);
  t.equal(res, 1, 'Self similarity is good');
  t.end();
});

test('it can compute jaccard similarity', t => {
  let a = fromDot(`
graph A {
  a -> {b; c; d};
  b -> c;
  d -> {c; e; f};
}`);

  let b = fromDot(`
graph A {
  a -> {b; c};
  b -> {c; d};
  d -> {e; c};
  c -> f;
}`);
  let res = getGraphWLJaccardSimilarity(a, b, 2);
  t.equal(res, 0.5, 'Kernel is as expected');
  res = getGraphWLJaccardSimilarity(b, a, 2);
  t.equal(res, 0.5, 'Conjugate kernel is as expected');
  res = getGraphWLJaccardSimilarity(a, a, 2);
  t.equal(res, 1, 'A Self similarity');
  res = getGraphWLJaccardSimilarity(b, b, 2);
  t.equal(res, 1, 'B Self similarity');
  t.end();
})
test('it can compute jaccard similarity on binary trees', t => {
  let a = generate.balancedBinTree(4); 
  let b = generate.balancedBinTree(5); 
  let res = getGraphWLJaccardSimilarity(a, b, 2);
t.equal(res, 0.49206349206349204, 'Kernel is as expected');
  t.end();
})
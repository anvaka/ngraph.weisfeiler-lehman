let test = require('tap').test;
let fromDot = require('ngraph.fromdot');
let {maybeIsomorphic} = require('..');
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
})
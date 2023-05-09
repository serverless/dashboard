from sls_sdk.lib.instrumentation.wrapper import replace_method


def test_replace_method():
    # given
    class Foo(object):
        def __init__(self):
            self.foo = "foo"

        def bar(self):
            return "bar"

    class Target(object):
        def method(self, original_method, instance, args, kwargs):
            original_result = original_method(*args, **kwargs)
            return (original_result, "baz", instance.foo)

    # when
    original = Foo.bar
    foo = Foo()
    result = foo.bar()

    # then
    assert result == "bar"

    # when
    target = Target()
    replace_method(Foo, "bar", target.method)
    result = foo.bar()

    # then
    assert result == ("bar", "baz", "foo")
    target_method = getattr(foo, "bar")
    assert target_method.__wrapped__ == original

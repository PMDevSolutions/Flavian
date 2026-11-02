---
name: wordpress-testing-workflows
description: Use when writing PHPUnit tests for WordPress themes or plugins, setting up test environments, configuring test suites, or implementing CI/CD test automation. Keywords: PHPUnit, testing, unit tests, integration tests, WordPress tests, test suite, WP_UnitTestCase, continuous integration
---

# WordPress Testing Workflows

## Overview

WordPress testing requires PHPUnit with the WordPress test suite, which provides `WP_UnitTestCase` for WordPress-specific test patterns. Tests should isolate functionality (unit tests) or verify WordPress integrations (integration tests) with proper setup/teardown to avoid test pollution.

**Core Principle:** Write tests FIRST (TDD), isolate tests completely, use factories for test data, clean up after each test, and automate testing in CI/CD.

## When to Use

Use this skill when:
- Writing PHPUnit tests for themes or plugins
- Setting up WordPress test suite
- Creating test fixtures and factories
- Testing WordPress hooks, filters, and custom post types
- Implementing test-driven development (TDD)
- Configuring CI/CD for automated testing
- Debugging test failures

**Symptoms that trigger this skill:**
- "write tests"
- "PHPUnit"
- "test coverage"
- "integration tests"
- "unit tests"
- "test suite"
- "WordPress testing"
- "TDD"

When NOT to use:
- Manual QA testing (exploratory testing)
- Frontend JavaScript testing (use Jest/Mocha instead)
- End-to-end testing (use Playwright/Cypress instead)

## Test Types Decision Matrix

| Test Type | When to Use | Example | Isolation Level |
|-----------|-------------|---------|-----------------|
| **Unit Test** | Test pure PHP logic | Utility functions, calculations | Complete (no database) |
| **Integration Test** | Test WordPress interactions | Custom post types, meta boxes, hooks | WordPress database |
| **Functional Test** | Test complete workflows | Form submission, AJAX handlers | Full WordPress environment |

## Quick Reference

### WordPress Test Suite Functions

| Function | Purpose | Example |
|----------|---------|---------|
| `$this->factory->post->create()` | Create test post | Create posts for testing |
| `$this->factory->user->create()` | Create test user | Test user capabilities |
| `$this->factory->term->create()` | Create test term | Test taxonomies |
| `$this->go_to()` | Navigate to URL | Test template loading |
| `update_option()` | Set test option | Test option retrieval |
| `set_current_screen()` | Mock admin screen | Test admin-only code |
| `$this->expectException()` | Assert exception thrown | Test error handling |

### PHPUnit Assertions

| Assertion | Purpose | Example |
|-----------|---------|---------|
| `assertSame()` | Exact match (type + value) | `assertSame( 5, $result )` |
| `assertEquals()` | Value match (loose) | `assertEquals( '5', 5 )` |
| `assertTrue()` | Boolean true | `assertTrue( has_filter( 'init' ) )` |
| `assertInstanceOf()` | Object type | `assertInstanceOf( WP_Post::class, $post )` |
| `assertCount()` | Array/collection count | `assertCount( 3, $posts )` |
| `assertContains()` | Array contains value | `assertContains( 'foo', $array )` |
| `assertEmpty()` | Empty array/string | `assertEmpty( $errors )` |

## Installation and Setup

### Step 1: Install PHPUnit

```bash
# Via Composer (recommended)
composer require --dev phpunit/phpunit ^9.0

# Verify installation
vendor/bin/phpunit --version
```

### Step 2: Scaffold WordPress Test Suite

```bash
# Navigate to plugin or theme directory
cd wp-content/plugins/myplugin/

# Scaffold test suite with WP-CLI
wp scaffold plugin-tests .

# Or for themes
# wp scaffold theme-tests .
```

**This creates:**
- `tests/` directory
- `phpunit.xml.dist` configuration
- `bin/install-wp-tests.sh` script
- `tests/bootstrap.php` loader
- `tests/test-sample.php` example test

### Step 3: Install WordPress Test Suite

```bash
# Run install script
bash bin/install-wp-tests.sh wordpress_test root '' localhost latest

# Parameters:
# 1. Database name (will be created)
# 2. Database user
# 3. Database password (empty if no password)
# 4. Database host
# 5. WordPress version (latest, 6.0, nightly)
```

### Step 4: Run Tests

```bash
# Run all tests
vendor/bin/phpunit

# Run specific test file
vendor/bin/phpunit tests/test-custom-post-type.php

# Run specific test method
vendor/bin/phpunit --filter test_post_creation

# Run with coverage
vendor/bin/phpunit --coverage-html coverage/
```

## Implementation Patterns

### Pattern 1: Testing Custom Post Type Registration

**File:** `tests/test-custom-post-type.php`

```php
<?php
/**
 * Test custom post type registration
 */
class Test_Custom_Post_Type extends WP_UnitTestCase {

    /**
     * Test post type is registered
     */
    public function test_post_type_exists() {
        $this->assertTrue( post_type_exists( 'book' ) );
    }

    /**
     * Test post type labels
     */
    public function test_post_type_labels() {
        $post_type = get_post_type_object( 'book' );

        $this->assertEquals( 'Books', $post_type->labels->name );
        $this->assertEquals( 'Book', $post_type->labels->singular_name );
    }

    /**
     * Test post type supports
     */
    public function test_post_type_supports() {
        $this->assertTrue( post_type_supports( 'book', 'title' ) );
        $this->assertTrue( post_type_supports( 'book', 'editor' ) );
        $this->assertTrue( post_type_supports( 'book', 'thumbnail' ) );
    }

    /**
     * Test post type is public
     */
    public function test_post_type_is_public() {
        $post_type = get_post_type_object( 'book' );

        $this->assertTrue( $post_type->public );
        $this->assertTrue( $post_type->has_archive );
    }

    /**
     * Test creating a book post
     */
    public function test_create_book_post() {
        $post_id = $this->factory->post->create( array(
            'post_type'   => 'book',
            'post_title'  => 'Test Book',
            'post_status' => 'publish',
        ) );

        $this->assertIsInt( $post_id );
        $this->assertEquals( 'book', get_post_type( $post_id ) );
    }
}
```

### Pattern 2: Testing Meta Boxes

**File:** `tests/test-meta-boxes.php`

```php
<?php
/**
 * Test custom meta boxes
 */
class Test_Meta_Boxes extends WP_UnitTestCase {

    private $post_id;

    /**
     * Setup before each test
     */
    public function setUp(): void {
        parent::setUp();

        // Create test post
        $this->post_id = $this->factory->post->create( array(
            'post_type' => 'book',
        ) );
    }

    /**
     * Cleanup after each test
     */
    public function tearDown(): void {
        wp_delete_post( $this->post_id, true );

        parent::tearDown();
    }

    /**
     * Test saving ISBN meta field
     */
    public function test_save_isbn_meta() {
        $isbn = '978-0-12-345678-9';

        update_post_meta( $this->post_id, 'book_isbn', $isbn );

        $saved_isbn = get_post_meta( $this->post_id, 'book_isbn', true );

        $this->assertEquals( $isbn, $saved_isbn );
    }

    /**
     * Test ISBN sanitization
     */
    public function test_isbn_sanitization() {
        // Function being tested
        $isbn = sanitize_isbn( '978 0 12 345678 9' );

        $this->assertEquals( '978-0-12-345678-9', $isbn );
    }

    /**
     * Test empty ISBN
     */
    public function test_empty_isbn() {
        $isbn = get_post_meta( $this->post_id, 'book_isbn', true );

        $this->assertEmpty( $isbn );
    }
}
```

### Pattern 3: Testing WordPress Hooks

**File:** `tests/test-hooks.php`

```php
<?php
/**
 * Test WordPress hooks (actions and filters)
 */
class Test_Hooks extends WP_UnitTestCase {

    /**
     * Test action hook is registered
     */
    public function test_init_action_registered() {
        $this->assertGreaterThan( 0, has_action( 'init', 'myplugin_register_post_type' ) );
    }

    /**
     * Test filter hook is registered
     */
    public function test_content_filter_registered() {
        $this->assertGreaterThan( 0, has_filter( 'the_content', 'myplugin_add_custom_content' ) );
    }

    /**
     * Test filter modifies content
     */
    public function test_content_filter_adds_text() {
        $original_content = 'Original content';
        $filtered_content = apply_filters( 'the_content', $original_content );

        $this->assertStringContainsString( 'Original content', $filtered_content );
        $this->assertStringContainsString( 'Custom addition', $filtered_content );
    }

    /**
     * Test removing filter
     */
    public function test_remove_filter() {
        remove_filter( 'the_content', 'myplugin_add_custom_content' );

        $content = apply_filters( 'the_content', 'Test' );

        $this->assertEquals( 'Test', $content );
    }
}
```

### Pattern 4: Testing AJAX Handlers

**File:** `tests/test-ajax.php`

```php
<?php
/**
 * Test AJAX handlers
 */
class Test_Ajax extends WP_Ajax_UnitTestCase {

    /**
     * Test AJAX handler for logged-in user
     */
    public function test_ajax_save_preferences_logged_in() {
        // Create and set user
        $user_id = $this->factory->user->create( array( 'role' => 'editor' ) );
        wp_set_current_user( $user_id );

        // Set up POST data
        $_POST['_ajax_nonce'] = wp_create_nonce( 'save_preferences_nonce' );
        $_POST['preference']  = 'color_scheme';
        $_POST['value']       = 'dark';

        // Make AJAX request
        try {
            $this->_handleAjax( 'save_preferences' );
        } catch ( WPAjaxDieContinueException $e ) {
            // Expected - AJAX handlers call wp_die()
        }

        // Verify response
        $response = json_decode( $this->_last_response, true );

        $this->assertTrue( $response['success'] );
    }

    /**
     * Test AJAX handler for logged-out user
     */
    public function test_ajax_save_preferences_logged_out() {
        wp_set_current_user( 0 );

        // Make AJAX request
        try {
            $this->_handleAjax( 'save_preferences' );
        } catch ( WPAjaxDieStopException $e ) {
            // Expected - should die with error
        }

        // Verify error response
        $response = json_decode( $this->_last_response, true );

        $this->assertFalse( $response['success'] );
    }
}
```

### Pattern 5: Testing REST API Endpoints

**File:** `tests/test-rest-api.php`

```php
<?php
/**
 * Test REST API endpoints
 */
class Test_Rest_API extends WP_UnitTestCase {

    private $server;

    /**
     * Setup REST API server
     */
    public function setUp(): void {
        parent::setUp();

        global $wp_rest_server;
        $this->server = $wp_rest_server = new WP_REST_Server;
        do_action( 'rest_api_init' );
    }

    /**
     * Cleanup
     */
    public function tearDown(): void {
        global $wp_rest_server;
        $wp_rest_server = null;

        parent::tearDown();
    }

    /**
     * Test endpoint is registered
     */
    public function test_endpoint_registered() {
        $routes = $this->server->get_routes();

        $this->assertArrayHasKey( '/myplugin/v1/books', $routes );
    }

    /**
     * Test GET request
     */
    public function test_get_books() {
        $request  = new WP_REST_Request( 'GET', '/myplugin/v1/books' );
        $response = $this->server->dispatch( $request );

        $this->assertEquals( 200, $response->get_status() );

        $data = $response->get_data();
        $this->assertIsArray( $data );
    }

    /**
     * Test POST request with authentication
     */
    public function test_create_book_authenticated() {
        // Create user with permission
        $user_id = $this->factory->user->create( array( 'role' => 'editor' ) );
        wp_set_current_user( $user_id );

        $request = new WP_REST_Request( 'POST', '/myplugin/v1/books' );
        $request->set_param( 'title', 'Test Book' );
        $request->set_param( 'isbn', '978-0-12-345678-9' );

        $response = $this->server->dispatch( $request );

        $this->assertEquals( 201, $response->get_status() );
    }

    /**
     * Test POST request without authentication
     */
    public function test_create_book_unauthorized() {
        wp_set_current_user( 0 );

        $request = new WP_REST_Request( 'POST', '/myplugin/v1/books' );
        $response = $this->server->dispatch( $request );

        $this->assertEquals( 401, $response->get_status() );
    }
}
```

### Pattern 6: Testing with Mock Data

**File:** `tests/test-with-mocks.php`

```php
<?php
/**
 * Test using mock HTTP requests and filters
 */
class Test_With_Mocks extends WP_UnitTestCase {

    /**
     * Test HTTP request with mock response
     */
    public function test_api_request_success() {
        // Mock HTTP response
        add_filter( 'pre_http_request', function( $preempt, $args, $url ) {
            return array(
                'body'     => '{"success":true,"data":"test"}',
                'response' => array( 'code' => 200 ),
            );
        }, 10, 3 );

        // Function being tested
        $result = myplugin_fetch_api_data();

        $this->assertTrue( $result['success'] );
        $this->assertEquals( 'test', $result['data'] );
    }

    /**
     * Test HTTP request failure
     */
    public function test_api_request_failure() {
        // Mock HTTP error
        add_filter( 'pre_http_request', function() {
            return new WP_Error( 'http_request_failed', 'Connection timeout' );
        } );

        $result = myplugin_fetch_api_data();

        $this->assertInstanceOf( WP_Error::class, $result );
    }

    /**
     * Test with temporary option
     */
    public function test_with_option() {
        update_option( 'myplugin_api_key', 'test_key_123' );

        $api_key = myplugin_get_api_key();

        $this->assertEquals( 'test_key_123', $api_key );

        // Cleanup handled automatically by WordPress test suite
    }
}
```

## Common Mistakes

### 1. Not Cleaning Up After Tests (Test Pollution)

**WRONG:**
```php
public function test_create_post() {
    $post_id = wp_insert_post( array( 'post_title' => 'Test' ) );
    // No cleanup - pollutes next test
}
```

**WHY THIS FAILS:**
- Data persists to next test
- Tests become dependent on order
- Flaky test results

**CORRECT:**
```php
public function setUp(): void {
    parent::setUp();
    $this->post_id = $this->factory->post->create();
}

public function tearDown(): void {
    wp_delete_post( $this->post_id, true );
    parent::tearDown();
}
```

### 2. Testing Implementation Instead of Behavior

**WRONG:**
```php
public function test_function_calls_wp_insert_post() {
    // Testing implementation details
    $this->assertTrue( function_exists( 'wp_insert_post' ) );
}
```

**WHY THIS FAILS:**
- Brittle - breaks when implementation changes
- Doesn't test actual functionality
- Not testing what users care about

**CORRECT:**
```php
public function test_creates_book_with_correct_title() {
    $post_id = create_book( 'My Book Title' );
    $post = get_post( $post_id );

    $this->assertEquals( 'My Book Title', $post->post_title );
    $this->assertEquals( 'book', $post->post_type );
}
```

### 3. Missing @group Annotations

**WRONG:**
```php
class Test_Slow_Operation extends WP_UnitTestCase {
    public function test_expensive_operation() {
        // Slow test without annotation
    }
}
```

**WHY THIS FAILS:**
- Cannot skip slow tests during development
- No way to run specific test groups
- Slows down TDD workflow

**CORRECT:**
```php
/**
 * @group slow
 * @group external
 */
class Test_Slow_Operation extends WP_UnitTestCase {
    public function test_expensive_operation() {
        // Can skip with: phpunit --exclude-group=slow
    }
}
```

### 4. Not Using Factories for Test Data

**WRONG:**
```php
public function test_with_post() {
    $post_id = wp_insert_post( array(
        'post_title'   => 'Test',
        'post_content' => 'Content',
        'post_status'  => 'publish',
        'post_author'  => 1,
        // ... many more fields
    ) );
}
```

**WHY THIS FAILS:**
- Verbose and error-prone
- Hardcoded values
- Difficult to maintain

**CORRECT:**
```php
public function test_with_post() {
    $post_id = $this->factory->post->create( array(
        'post_title' => 'Test',
    ) );
}
```

### 5. assertEquals Instead of assertSame

**WRONG:**
```php
public function test_user_id() {
    $user_id = get_current_user_id();
    $this->assertEquals( '123', $user_id ); // Loose comparison
}
```

**WHY THIS FAILS:**
- Passes when it shouldn't (string '123' == integer 123)
- Hides type bugs
- Not strict enough

**CORRECT:**
```php
public function test_user_id() {
    $user_id = get_current_user_id();
    $this->assertSame( 123, $user_id ); // Strict comparison (type + value)
}
```

### 6. Not Testing Edge Cases

**WRONG:**
```php
public function test_divide() {
    $result = divide( 10, 2 );
    $this->assertEquals( 5, $result );
}
```

**WHY THIS FAILS:**
- Doesn't test division by zero
- Doesn't test negative numbers
- Doesn't test non-integers

**CORRECT:**
```php
public function test_divide() {
    $this->assertEquals( 5, divide( 10, 2 ) );
    $this->assertEquals( -5, divide( 10, -2 ) );
    $this->assertEquals( 2.5, divide( 5, 2 ) );
}

public function test_divide_by_zero() {
    $this->expectException( DivisionByZeroError::class );
    divide( 10, 0 );
}
```

### 7. Not Running Tests Before Committing

**WRONG:**
```bash
# Make changes
git add .
git commit -m "Add feature"
# Never ran tests
```

**WHY THIS FAILS:**
- Broken code in repository
- CI/CD pipeline fails
- Other developers blocked

**CORRECT:**
```bash
# Make changes
vendor/bin/phpunit

# Only commit if tests pass
if [ $? -eq 0 ]; then
    git add .
    git commit -m "Add feature"
else
    echo "Tests failed! Fix before committing."
fi
```

## Red Flags - Rationalization Detection

| Rationalization | Reality | Correct Action |
|----------------|---------|----------------|
| "I'll write tests later" | Later never comes | Write tests FIRST (TDD) |
| "This function is too simple to test" | Simple code breaks too | Test all public functions |
| "Tests slow down development" | Tests speed up debugging | Write tests incrementally |
| "It works in manual testing" | Manual testing doesn't scale | Automate with PHPUnit |
| "I'll clean up test data manually" | Causes test pollution | Use setUp/tearDown |
| "assertEquals is good enough" | Type bugs slip through | Use assertSame for strict comparison |
| "Edge cases are rare" | Edge cases cause bugs | Test edge cases explicitly |

## No Exceptions

**NEVER skip these testing practices:**

1. ✅ **Write tests FIRST (TDD)** - Red, green, refactor cycle
2. ✅ **Clean up after tests** - Use setUp/tearDown methods
3. ✅ **Test behavior, not implementation** - Test what, not how
4. ✅ **Use strict assertions** - assertSame over assertEquals
5. ✅ **Test edge cases** - Empty, null, zero, negative, boundary values
6. ✅ **Run tests before committing** - Ensure code works
7. ✅ **Use @group annotations** - Organize and filter tests

**"I'll write tests later" is the #1 lie developers tell themselves.**
**"It's just a small change" is not a valid reason to skip tests.**
**"Manual testing is enough" is false confidence.**

## CI/CD Integration

### GitHub Actions

**File:** `.github/workflows/tests.yml`

```yaml
name: PHPUnit Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mysql:
        image: mysql:5.7
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: wordpress_test
        ports:
          - 3306:3306
        options: --health-cmd="mysqladmin ping" --health-interval=10s --health-timeout=5s --health-retries=3

    steps:
      - uses: actions/checkout@v3

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.0'
          extensions: mysqli

      - name: Install dependencies
        run: composer install --prefer-dist --no-progress

      - name: Install WordPress test suite
        run: bash bin/install-wp-tests.sh wordpress_test root root 127.0.0.1 latest

      - name: Run tests
        run: vendor/bin/phpunit

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage.xml
```

## Integration with This Template

This skill works with:
- **test-writer-fixer agent** - Writing and fixing PHPUnit tests
- **fse-block-theme-development skill** - Testing theme functionality
- **wp-cli-workflows skill** - Scaffolding test suites with WP-CLI
- **wordpress-deployment-automation skill** - CI/CD test automation

Complements:
- **wordpress-security-hardening skill** - Writing security tests
- **git** - commit only after the tests pass (Conventional Commits; release-please reads them)

## Resources

- [WordPress PHPUnit Handbook](https://make.wordpress.org/core/handbook/testing/automated-testing/phpunit/)
- [WP_UnitTestCase Reference](https://make.wordpress.org/core/handbook/testing/automated-testing/writing-phpunit-tests/)
- [PHPUnit Documentation](https://phpunit.de/documentation.html)
- [WordPress Test Suite GitHub](https://github.com/WordPress/wordpress-develop)
- [WordPress Test Factories](https://make.wordpress.org/core/handbook/testing/automated-testing/writing-phpunit-tests/#fixtures-and-factories)

---

**Skill Version:** 1.0.0
**Last Updated:** 2026-01-18
**Tested Against:** PHPUnit 9.0+, WordPress 6.7+
**Testing Methodology:** RED-GREEN-REFACTOR (TDD for documentation)

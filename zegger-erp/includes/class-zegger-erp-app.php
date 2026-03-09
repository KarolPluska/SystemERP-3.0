<?php
if (!defined('ABSPATH')) { exit; }

final class ZEGGER_ERP_App {
  const QUERY_VAR = 'zegger_erp';
  const QUERY_VAR_MODULE = 'zegger_erp_module';
  const ROUTE_SLUG = 'zegger-erp';
  const STYLE_HANDLE = 'zegger-erp-shell-style';
  const SCRIPT_HANDLE = 'zegger-erp-shell-script';

  public static function init(){
    add_filter('query_vars', array(__CLASS__, 'query_vars'));
    add_action('init', array(__CLASS__, 'add_rewrite_rules'));
    add_action('template_redirect', array(__CLASS__, 'maybe_render'), 0);
  }

  public static function activate(){
    self::add_rewrite_rules();
  }

  public static function deactivate(){
    // no-op
  }

  public static function query_vars($vars){
    $vars[] = self::QUERY_VAR;
    $vars[] = self::QUERY_VAR_MODULE;
    return $vars;
  }

  public static function add_rewrite_rules(){
    add_rewrite_rule('^' . self::ROUTE_SLUG . '/?$', 'index.php?' . self::QUERY_VAR . '=1', 'top');
    add_rewrite_rule('^' . self::ROUTE_SLUG . '/([a-z0-9_-]+)/?$', 'index.php?' . self::QUERY_VAR . '=1&' . self::QUERY_VAR_MODULE . '=$matches[1]', 'top');
  }

  public static function app_url($module = ''){
    $module = sanitize_key((string) $module);
    if ($module === '') {
      return home_url('/' . self::ROUTE_SLUG . '/');
    }
    return home_url('/' . self::ROUTE_SLUG . '/' . rawurlencode($module) . '/');
  }

  public static function offer_panel_url(){
    return add_query_arg(array(
      'zq_offer_panel' => '1',
      'embed' => '1',
    ), home_url('/'));
  }

  public static function maybe_render(){
    $q = get_query_var(self::QUERY_VAR, '');
    if ((string) $q !== '1') { return; }

    self::render();
    exit;
  }

  private static function render(){
    $module = sanitize_key((string) get_query_var(self::QUERY_VAR_MODULE, ''));
    $allowed = array('start', 'offers');
    if (!in_array($module, $allowed, true)) {
      $module = 'start';
    }

    nocache_headers();
    status_header(200);
    header('Content-Type: text/html; charset=' . get_bloginfo('charset'));
    header('X-Robots-Tag: noindex, nofollow', true);

    wp_register_style(
      self::STYLE_HANDLE,
      ZEGGER_ERP_PLUGIN_URL . 'assets/css/zegger-erp-shell.css',
      array(),
      ZEGGER_ERP_VERSION
    );
    wp_enqueue_style(self::STYLE_HANDLE);

    wp_register_script(
      self::SCRIPT_HANDLE,
      ZEGGER_ERP_PLUGIN_URL . 'assets/js/zegger-erp-shell.js',
      array(),
      ZEGGER_ERP_VERSION,
      true
    );

    $boot = array(
      'version' => ZEGGER_ERP_VERSION,
      'initialModule' => $module,
      'routes' => array(
        'app' => self::app_url(),
        'offerPanel' => self::offer_panel_url(),
      ),
      'rest' => array(
        'erpNs' => '/' . ltrim(ZEGGER_ERP_Rest::NS, '/'),
        'legacyNs' => '/' . ltrim(ZQOS_Rest::NS, '/'),
      ),
      'ui' => array(
        'brand' => 'ZEGGER ERP',
        'confirmLeave' => 'Masz niezapisane zmiany w module ofert. Czy na pewno chcesz opuścić ten widok?',
      ),
    );

    wp_add_inline_script(
      self::SCRIPT_HANDLE,
      'window.ZEGGER_ERP_BOOT = ' . wp_json_encode($boot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . ';',
      'before'
    );
    wp_enqueue_script(self::SCRIPT_HANDLE);

    ?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo('charset'); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title><?php echo esc_html(get_bloginfo('name') . ' - ZEGGER ERP'); ?></title>
  <?php wp_head(); ?>
</head>
<body class="zegger-erp-page">
  <div id="zegger-erp-app" class="zegger-erp" data-initial-module="<?php echo esc_attr($module); ?>">
    <div class="zegger-erp__boot" role="status" aria-live="polite">Ładowanie ERP...</div>
  </div>
  <?php wp_footer(); ?>
</body>
</html>
    <?php
  }
}

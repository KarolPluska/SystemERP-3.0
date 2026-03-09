<?php
/**
 * Plugin Name: ZEGGER ERP Runtime
 * Description: Docelowy runtime System ERP 3.0 z kompaktowym shellem i kompatybilnym modułem ofertowym.
 * Version: 3.0.0
 * Author: ZEGGER TECH
 * License: Proprietary
 */

if (!defined('ABSPATH')) { exit; }

if (defined('ZEGGER_ERP_BOOTSTRAPPED')) { return; }
define('ZEGGER_ERP_BOOTSTRAPPED', true);

define('ZEGGER_ERP_VERSION', '3.0.0');
define('ZEGGER_ERP_PLUGIN_FILE', __FILE__);
define('ZEGGER_ERP_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('ZEGGER_ERP_PLUGIN_URL', plugin_dir_url(__FILE__));

if (!defined('ZQOS_VERSION')) { define('ZQOS_VERSION', ZEGGER_ERP_VERSION); }
if (!defined('ZQOS_PLUGIN_FILE')) { define('ZQOS_PLUGIN_FILE', ZEGGER_ERP_PLUGIN_FILE); }
if (!defined('ZQOS_PLUGIN_DIR')) { define('ZQOS_PLUGIN_DIR', ZEGGER_ERP_PLUGIN_DIR); }
if (!defined('ZQOS_PLUGIN_URL')) { define('ZQOS_PLUGIN_URL', ZEGGER_ERP_PLUGIN_URL); }


$legacyPlugin = 'zq-offer-suite-v1.2.18.7/zq-offer-suite.php';
$activePlugins = (array) get_option('active_plugins', array());
$legacyActive = in_array($legacyPlugin, $activePlugins, true);
if (!$legacyActive && is_multisite()) {
  $networkActive = (array) get_site_option('active_sitewide_plugins', array());
  $legacyActive = isset($networkActive[$legacyPlugin]);
}

if ($legacyActive) {
  add_action('admin_notices', function(){
    if (!current_user_can('activate_plugins')) { return; }
    echo '<div class="notice notice-error"><p><strong>ZEGGER ERP Runtime:</strong> wykryto aktywny plugin legacy <code>zq-offer-suite-v1.2.18.7</code>. Najpierw wyłącz plugin legacy, następnie aktywuj <code>zegger-erp</code>.</p></div>';
  });
  return;
}
if (defined('ZQOS_PLUGIN_FILE') && wp_normalize_path((string) ZQOS_PLUGIN_FILE) !== wp_normalize_path((string) __FILE__)) {
  add_action('admin_notices', function(){
    if (!current_user_can('activate_plugins')) { return; }
    echo '<div class="notice notice-error"><p><strong>ZEGGER ERP Runtime:</strong> wykryto aktywną starszą wtyczkę ZQ Offer Suite. Wyłącz starszą wtyczkę i zostaw aktywną tylko <code>zegger-erp</code>.</p></div>';
  });
  return;
}

function zegger_erp_require_class($class_name, $relative_path){
  if (class_exists($class_name, false)) { return; }
  require_once ZEGGER_ERP_PLUGIN_DIR . ltrim($relative_path, '/');
}

zegger_erp_require_class('ZQOS_DB', 'includes/legacy/class-zqos-db.php');
zegger_erp_require_class('ZQOS_Sheets', 'includes/legacy/class-zqos-sheets.php');
zegger_erp_require_class('ZQOS_Auth', 'includes/legacy/class-zqos-auth.php');
zegger_erp_require_class('ZQOS_Rest', 'includes/legacy/class-zqos-rest.php');
zegger_erp_require_class('ZQOS_Admin', 'includes/legacy/class-zqos-admin.php');
zegger_erp_require_class('ZQOS_Panel', 'includes/legacy/class-zqos-panel.php');
zegger_erp_require_class('ZQOS_Maintenance', 'includes/legacy/class-zqos-maintenance.php');
zegger_erp_require_class('ZQOS_Reminders', 'includes/legacy/class-zqos-reminders.php');
zegger_erp_require_class('ZEGGER_ERP_Rest', 'includes/class-zegger-erp-rest.php');
zegger_erp_require_class('ZEGGER_ERP_App', 'includes/class-zegger-erp-app.php');

final class ZEGGER_ERP_Bootstrap {

  public static function activate(){
    ZQOS_DB::activate();
    ZQOS_Sheets::activate();
    ZQOS_Maintenance::activate();
    ZQOS_Reminders::activate();
    ZQOS_Panel::activate();
    ZEGGER_ERP_App::activate();
    flush_rewrite_rules();
  }

  public static function deactivate(){
    ZQOS_Sheets::deactivate();
    ZQOS_Maintenance::deactivate();
    ZQOS_Reminders::deactivate();
    ZEGGER_ERP_App::deactivate();
    flush_rewrite_rules();
  }

  public static function init(){
    ZQOS_DB::init();
    ZQOS_Sheets::init();
    ZQOS_Maintenance::init();
    ZQOS_Reminders::init();
    ZQOS_Rest::init();
    ZQOS_Admin::init();
    ZQOS_Panel::init();
    ZEGGER_ERP_Rest::init();
    ZEGGER_ERP_App::init();
  }
}

register_activation_hook(__FILE__, array('ZEGGER_ERP_Bootstrap', 'activate'));
register_deactivation_hook(__FILE__, array('ZEGGER_ERP_Bootstrap', 'deactivate'));
add_action('plugins_loaded', array('ZEGGER_ERP_Bootstrap', 'init'));

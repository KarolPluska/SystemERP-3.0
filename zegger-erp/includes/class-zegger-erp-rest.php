<?php
if (!defined('ABSPATH')) { exit; }

final class ZEGGER_ERP_Rest {
  const NS = 'zegger-erp/v1';

  public static function init(){
    add_action('rest_api_init', array(__CLASS__, 'register_routes'));
  }

  public static function register_routes(){
    register_rest_route(self::NS, '/bootstrap', array(
      'methods' => 'GET',
      'permission_callback' => '__return_true',
      'callback' => array(__CLASS__, 'route_bootstrap'),
    ));

    register_rest_route(self::NS, '/session', array(
      'methods' => 'GET',
      'permission_callback' => '__return_true',
      'callback' => array(__CLASS__, 'route_session_get'),
    ));

    register_rest_route(self::NS, '/session/login', array(
      'methods' => 'POST',
      'permission_callback' => '__return_true',
      'callback' => array(__CLASS__, 'route_session_login'),
      'args' => array(
        'login' => array('required' => true),
        'password' => array('required' => true),
      ),
    ));

    register_rest_route(self::NS, '/session/logout', array(
      'methods' => 'POST',
      'permission_callback' => array(__CLASS__, 'perm_account'),
      'callback' => array(__CLASS__, 'route_session_logout'),
    ));
  }

  public static function perm_account(){
    return (bool) ZQOS_Auth::require_account();
  }

  public static function route_bootstrap(){
    return rest_ensure_response(array(
      'ok' => true,
      'version' => ZEGGER_ERP_VERSION,
      'routes' => array(
        'erp_ns' => '/' . ltrim(self::NS, '/'),
        'legacy_ns' => '/' . ltrim(ZQOS_Rest::NS, '/'),
      ),
      'urls' => array(
        'app' => ZEGGER_ERP_App::app_url(),
        'offer_panel' => ZEGGER_ERP_App::offer_panel_url(),
      ),
      'ts' => time(),
    ));
  }

  public static function route_session_get(){
    $acc = ZQOS_Auth::require_account();
    if (!$acc) {
      return rest_ensure_response(array(
        'ok' => true,
        'authenticated' => false,
      ));
    }

    $actor = ZQOS_Auth::actor_summary();
    return rest_ensure_response(array(
      'ok' => true,
      'authenticated' => true,
      'account' => $acc,
      'actor' => $actor,
      'can_switch' => (bool) ZQOS_Auth::actor_has_permission('super_admin'),
    ));
  }

  public static function route_session_login(\WP_REST_Request $req){
    $login = sanitize_text_field((string) $req->get_param('login'));
    $password = (string) $req->get_param('password');

    $res = ZQOS_Auth::login($login, $password);
    if (empty($res['ok'])) {
      return new \WP_REST_Response(array(
        'ok' => false,
        'message' => isset($res['message']) ? (string) $res['message'] : 'Błąd logowania.',
      ), 401);
    }

    if (!empty($res['token'])) {
      ZQOS_Auth::set_auth_cookie($res['token'], $res['expires_at'] ?? null);
    }

    $res['actor'] = ZQOS_Auth::actor_summary();
    return rest_ensure_response($res);
  }

  public static function route_session_logout(){
    return rest_ensure_response(ZQOS_Auth::logout());
  }
}

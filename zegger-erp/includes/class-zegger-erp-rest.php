<?php
if (!defined('ABSPATH')) { exit; }

final class ZEGGER_ERP_Rest {
  const NS = 'zegger-erp/v1';
  const OPT_JOIN_CODES = 'zegger_erp_company_join_codes';

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

    register_rest_route(self::NS, '/session/register-company', array(
      'methods' => 'POST',
      'permission_callback' => '__return_true',
      'callback' => array(__CLASS__, 'route_session_register_company'),
      'args' => array(
        'company_name' => array('required' => true),
        'admin_login' => array('required' => true),
        'password' => array('required' => true),
      ),
    ));

    register_rest_route(self::NS, '/session/join-company', array(
      'methods' => 'POST',
      'permission_callback' => '__return_true',
      'callback' => array(__CLASS__, 'route_session_join_company'),
      'args' => array(
        'join_code' => array('required' => true),
        'login' => array('required' => true),
        'password' => array('required' => true),
      ),
    ));

    register_rest_route(self::NS, '/company/users', array(
      'methods' => 'GET',
      'permission_callback' => array(__CLASS__, 'perm_account'),
      'callback' => array(__CLASS__, 'route_company_users'),
    ));

    register_rest_route(self::NS, '/company/join-codes', array(
      'methods' => 'GET',
      'permission_callback' => array(__CLASS__, 'perm_company_manager'),
      'callback' => array(__CLASS__, 'route_company_join_codes_get'),
    ));

    register_rest_route(self::NS, '/company/join-codes', array(
      'methods' => 'POST',
      'permission_callback' => array(__CLASS__, 'perm_company_manager'),
      'callback' => array(__CLASS__, 'route_company_join_codes_create'),
      'args' => array(
        'expires_days' => array('required' => false),
      ),
    ));
    register_rest_route(self::NS, '/messenger/messages', array(
      'methods' => 'GET',
      'permission_callback' => array(__CLASS__, 'perm_account'),
      'callback' => array(__CLASS__, 'route_messenger_messages_get'),
      'args' => array(
        'limit' => array('required' => false),
      ),
    ));

    register_rest_route(self::NS, '/messenger/messages', array(
      'methods' => 'POST',
      'permission_callback' => array(__CLASS__, 'perm_account'),
      'callback' => array(__CLASS__, 'route_messenger_messages_create'),
      'args' => array(
        'text' => array('required' => true),
      ),
    ));

    register_rest_route(self::NS, '/notifications', array(
      'methods' => 'GET',
      'permission_callback' => array(__CLASS__, 'perm_account'),
      'callback' => array(__CLASS__, 'route_notifications_get'),
      'args' => array(
        'limit' => array('required' => false),
      ),
    ));
  }

  public static function perm_account(){
    return (bool) ZQOS_Auth::require_account();
  }

  public static function perm_company_manager(){
    $acc = ZQOS_Auth::require_account();
    if (!$acc) { return false; }

    if (ZQOS_Auth::actor_has_permission('super_admin')) {
      return true;
    }

    $role = self::account_company_role($acc);
    return in_array($role, array('owner', 'admin'), true);
  }

  private static function module_list(){
    return array(
      'start',
      'offers',
      'company-users',
      'product-library',
      'messenger',
      'notifications',
    );
  }

  private static function auth_entry_modes(){
    return array(
      'login',
      'register-company',
      'join-company',
    );
  }

  private static function clean_text($value, $max = 190){
    $txt = sanitize_text_field((string) $value);
    if (strlen($txt) > $max) {
      $txt = substr($txt, 0, $max);
    }
    return $txt;
  }

  private static function normalize_login($value){
    $login = self::clean_text($value, 64);
    $login = trim($login);
    if ($login === '') { return ''; }
    if (!preg_match('/^[A-Za-z0-9._-]{3,64}$/', $login)) {
      return '';
    }
    return $login;
  }

  private static function normalize_password($value){
    $pass = (string) $value;
    if (strlen($pass) < 8 || strlen($pass) > 255) {
      return '';
    }
    return $pass;
  }

  private static function decode_json_array($raw){
    $arr = ZQOS_Auth::decode_json($raw);
    return is_array($arr) ? $arr : array();
  }

  private static function account_company_root_id($acc){
    if (!is_array($acc)) { return 0; }

    $perms = isset($acc['perms']) && is_array($acc['perms']) ? $acc['perms'] : array();
    $root = isset($perms['company_root_id']) ? (int) $perms['company_root_id'] : 0;
    if ($root <= 0) {
      $root = isset($acc['id']) ? (int) $acc['id'] : 0;
    }
    return $root > 0 ? $root : 0;
  }

  private static function account_company_role($acc){
    if (!is_array($acc)) { return 'member'; }

    $perms = isset($acc['perms']) && is_array($acc['perms']) ? $acc['perms'] : array();
    $role = isset($perms['company_role']) ? strtolower(trim((string) $perms['company_role'])) : '';

    if (!in_array($role, array('owner', 'admin', 'member'), true)) {
      $role = 'member';
      if (self::account_company_root_id($acc) === (int) ($acc['id'] ?? 0)) {
        $role = 'owner';
      }
    }

    return $role;
  }

  private static function account_company_name($acc){
    if (!is_array($acc)) { return ''; }

    $perms = isset($acc['perms']) && is_array($acc['perms']) ? $acc['perms'] : array();
    $name = isset($perms['company_name']) ? self::clean_text($perms['company_name'], 160) : '';
    if ($name !== '') {
      return $name;
    }

    return isset($acc['login']) ? self::clean_text($acc['login'], 64) : '';
  }

  private static function account_default_profile($seller_name, $seller_email, $company_name){
    return array(
      'avatar_url' => '',
      'cover_url' => '',
      'time_total_sec' => 0,
      'seller_name' => $seller_name,
      'seller_email' => $seller_email,
      'company_name' => $company_name,
    );
  }

  private static function account_default_perms($company_name, $company_root_id, $company_role, $seller_name, $seller_email){
    return array(
      'can_view_all_clients' => false,
      'can_force_sync' => false,
      'can_view_stats' => true,
      'super_admin' => false,
      'can_delete_offers_any' => false,
      'can_delete_offers_own' => true,
      'can_lock_offers' => false,
      'allow_special_offer' => true,
      'max_discount_percent' => 100,
      'allowed_tabs' => array(),
      'company_root_id' => (int) $company_root_id,
      'company_role' => $company_role,
      'company_name' => $company_name,
      'seller' => array(
        'name' => $seller_name,
        'phone' => '',
        'email' => $seller_email,
        'branch' => $company_name,
      ),
    );
  }

  private static function account_exists_by_login($login){
    global $wpdb;
    $t = ZQOS_DB::tables();

    $id = (int) $wpdb->get_var($wpdb->prepare(
      "SELECT id FROM {$t['accounts']} WHERE login = %s LIMIT 1",
      $login
    ));

    return $id > 0;
  }

  private static function insert_account($login, $password, $perms, $profile){
    global $wpdb;
    $t = ZQOS_DB::tables();

    $now = current_time('mysql');
    $ok = $wpdb->insert($t['accounts'], array(
      'login' => $login,
      'pass_hash' => password_hash($password, PASSWORD_DEFAULT),
      'perms' => wp_json_encode($perms),
      'fixed_client' => null,
      'profile' => wp_json_encode($profile),
      'created_at' => $now,
      'updated_at' => $now,
    ), array('%s', '%s', '%s', '%s', '%s', '%s', '%s'));

    if (!$ok) {
      return 0;
    }

    return (int) $wpdb->insert_id;
  }

  private static function update_account_perms($account_id, $perms){
    global $wpdb;
    $t = ZQOS_DB::tables();

    $wpdb->update($t['accounts'], array(
      'perms' => wp_json_encode($perms),
      'updated_at' => current_time('mysql'),
    ), array(
      'id' => (int) $account_id,
    ), array('%s', '%s'), array('%d'));
  }

  private static function ensure_company_client($company_name, $admin_name, $admin_email){
    global $wpdb;
    $t = ZQOS_DB::tables();

    $now = current_time('mysql');
    $ok = $wpdb->insert($t['clients'], array(
      'full_name' => $admin_name !== '' ? $admin_name : null,
      'company' => $company_name,
      'nip' => null,
      'phone' => null,
      'email' => $admin_email !== '' ? $admin_email : null,
      'address' => null,
      'created_at' => $now,
      'updated_at' => $now,
    ), array('%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s'));

    if (!$ok) {
      return 0;
    }

    return (int) $wpdb->insert_id;
  }

  private static function assign_account_client($account_id, $client_id){
    if ((int) $account_id <= 0 || (int) $client_id <= 0) {
      return;
    }

    global $wpdb;
    $t = ZQOS_DB::tables();

    $wpdb->replace($t['acmap'], array(
      'account_id' => (int) $account_id,
      'client_id' => (int) $client_id,
    ), array('%d', '%d'));
  }

  private static function find_company_client_for_root($root_account_id){
    global $wpdb;
    $t = ZQOS_DB::tables();

    $cid = (int) $wpdb->get_var($wpdb->prepare(
      "SELECT client_id FROM {$t['acmap']} WHERE account_id = %d ORDER BY client_id ASC LIMIT 1",
      (int) $root_account_id
    ));

    return $cid > 0 ? $cid : 0;
  }

  private static function issue_cookie_session($account_id){
    $issued = ZQOS_Auth::issue_token_for_account((int) $account_id, null);
    if (!is_array($issued) || empty($issued['token'])) {
      return null;
    }

    ZQOS_Auth::set_auth_cookie($issued['token'], $issued['expires_at'] ?? null);
    return $issued;
  }

  private static function join_codes_store(){
    $raw = get_option(self::OPT_JOIN_CODES, array());
    return is_array($raw) ? $raw : array();
  }

  private static function save_join_codes_store($store){
    if (!is_array($store)) { $store = array(); }
    update_option(self::OPT_JOIN_CODES, $store, false);
  }

  private static function normalize_join_code($code){
    $code = strtoupper((string) $code);
    $code = preg_replace('/[^A-Z0-9]/', '', $code);
    if (!is_string($code)) { return ''; }
    if (strlen($code) < 6 || strlen($code) > 16) {
      return '';
    }
    return $code;
  }

  private static function cleanup_join_codes(&$store){
    if (!is_array($store)) {
      $store = array();
      return;
    }

    $now = current_time('timestamp');
    foreach ($store as $code => $row) {
      if (!is_array($row)) {
        unset($store[$code]);
        continue;
      }

      $norm = self::normalize_join_code($code);
      if ($norm === '') {
        unset($store[$code]);
        continue;
      }

      if (!empty($row['expires_at'])) {
        $exp = strtotime((string) $row['expires_at']);
        if ($exp && $exp < $now) {
          unset($store[$code]);
          continue;
        }
      }

      if (isset($row['active']) && !$row['active']) {
        unset($store[$code]);
        continue;
      }
    }

    if (count($store) > 300) {
      uasort($store, function($a, $b){
        $at = isset($a['created_at']) ? strtotime((string) $a['created_at']) : 0;
        $bt = isset($b['created_at']) ? strtotime((string) $b['created_at']) : 0;
        if ($at === $bt) { return 0; }
        return ($at < $bt) ? 1 : -1;
      });
      $store = array_slice($store, 0, 300, true);
    }
  }

  private static function random_join_code(){
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $len = strlen($alphabet);
    $out = '';
    for ($i = 0; $i < 8; $i++) {
      $idx = random_int(0, $len - 1);
      $out .= $alphabet[$idx];
    }
    return $out;
  }

  private static function create_join_code($root_id, $company_name, $company_client_id, $created_by, $expires_days = 30){
    $root_id = (int) $root_id;
    if ($root_id <= 0) {
      return null;
    }

    $store = self::join_codes_store();
    self::cleanup_join_codes($store);

    $code = '';
    for ($i = 0; $i < 20; $i++) {
      $candidate = self::random_join_code();
      if (!isset($store[$candidate])) {
        $code = $candidate;
        break;
      }
    }

    if ($code === '') {
      return null;
    }

    $days = (int) $expires_days;
    if ($days < 1) { $days = 1; }
    if ($days > 365) { $days = 365; }

    $created_at = current_time('mysql');
    $expires_at = wp_date('Y-m-d H:i:s', current_time('timestamp') + ($days * DAY_IN_SECONDS));

    $row = array(
      'code' => $code,
      'root_id' => $root_id,
      'company_name' => self::clean_text($company_name, 160),
      'company_client_id' => (int) $company_client_id,
      'created_by' => (int) $created_by,
      'created_at' => $created_at,
      'expires_at' => $expires_at,
      'active' => 1,
    );

    $store[$code] = $row;
    self::save_join_codes_store($store);

    return $row;
  }

  private static function join_codes_for_root($root_id){
    $root_id = (int) $root_id;
    if ($root_id <= 0) { return array(); }

    $store = self::join_codes_store();
    self::cleanup_join_codes($store);
    self::save_join_codes_store($store);

    $out = array();
    foreach ($store as $code => $row) {
      if (!is_array($row)) { continue; }
      if ((int) ($row['root_id'] ?? 0) !== $root_id) { continue; }
      $out[] = array(
        'code' => self::normalize_join_code($code),
        'company_name' => self::clean_text($row['company_name'] ?? '', 160),
        'created_at' => (string) ($row['created_at'] ?? ''),
        'expires_at' => (string) ($row['expires_at'] ?? ''),
      );
    }

    usort($out, function($a, $b){
      $at = strtotime((string) ($a['created_at'] ?? '')) ?: 0;
      $bt = strtotime((string) ($b['created_at'] ?? '')) ?: 0;
      if ($at === $bt) { return 0; }
      return ($at < $bt) ? 1 : -1;
    });

    return $out;
  }

  private static function join_code_lookup($join_code){
    $code = self::normalize_join_code($join_code);
    if ($code === '') {
      return null;
    }

    $store = self::join_codes_store();
    self::cleanup_join_codes($store);
    self::save_join_codes_store($store);

    if (!isset($store[$code]) || !is_array($store[$code])) {
      return null;
    }

    $row = $store[$code];
    if ((int) ($row['active'] ?? 0) !== 1) {
      return null;
    }

    return $row;
  }

  private static function account_seller_name_from_perms($perms){
    if (!is_array($perms)) { return ''; }
    if (!isset($perms['seller']) || !is_array($perms['seller'])) { return ''; }
    return self::clean_text($perms['seller']['name'] ?? '', 120);
  }

  private static function company_accounts_map($root_id){
    $root_id = (int) $root_id;
    if ($root_id <= 0) { return array(); }

    global $wpdb;
    $t = ZQOS_DB::tables();

    $rows = $wpdb->get_results("SELECT id, login, perms FROM {$t['accounts']} ORDER BY id ASC", ARRAY_A);
    if (!is_array($rows)) { $rows = array(); }

    $out = array();
    foreach ($rows as $row) {
      $id = isset($row['id']) ? (int) $row['id'] : 0;
      if ($id <= 0) { continue; }

      $perms = self::decode_json_array($row['perms'] ?? null);
      $company_root = isset($perms['company_root_id']) ? (int) $perms['company_root_id'] : $id;
      if ($company_root <= 0) { $company_root = $id; }
      if ($company_root !== $root_id) { continue; }

      $out[$id] = array(
        'id' => $id,
        'login' => self::clean_text($row['login'] ?? '', 64),
        'seller_name' => self::account_seller_name_from_perms($perms),
      );
    }

    return $out;
  }

  private static function event_meta($raw){
    $meta = ZQOS_Auth::decode_json($raw);
    return is_array($meta) ? $meta : array();
  }

  private static function format_notification_label($event){
    $event = sanitize_key((string) $event);
    switch ($event) {
      case 'offer_saved': return 'Oferta zapisana';
      case 'offer_updated': return 'Oferta zaktualizowana';
      case 'offer_status': return 'Status oferty zmieniony';
      case 'offer_exported': return 'PDF oferty zapisany';
      case 'offer_deleted': return 'Oferta usunieta';
      case 'offer_duplicated': return 'Oferta zduplikowana';
      case 'offer_locked': return 'Oferta zablokowana';
      case 'offer_unlocked': return 'Oferta odblokowana';
      case 'client_saved': return 'Klient zapisany';
      case 'profile_saved': return 'Profil konta zaktualizowany';
      case 'company_register': return 'Nowa firma zalozona';
      case 'company_join': return 'Nowe konto dolaczylo do firmy';
      case 'erp_message': return 'Nowa wiadomosc';
      default: return $event !== '' ? $event : 'Zdarzenie';
    }
  }

  private static function format_notification_message($event, $meta){
    $event = sanitize_key((string) $event);
    $meta = is_array($meta) ? $meta : array();

    switch ($event) {
      case 'offer_status':
        $status = isset($meta['status']) ? self::clean_text($meta['status'], 60) : '';
        return $status !== '' ? ('Ustawiono status: ' . $status . '.') : 'Zmieniono status oferty.';

      case 'offer_exported':
      case 'offer_saved':
      case 'offer_updated':
      case 'offer_deleted':
      case 'offer_duplicated':
      case 'offer_locked':
      case 'offer_unlocked':
        $title = isset($meta['title']) ? self::clean_text($meta['title'], 180) : '';
        return $title !== '' ? ('Oferta: ' . $title) : '';

      case 'client_saved':
        if (!empty($meta['client_id'])) {
          return 'ID klienta: ' . (int) $meta['client_id'];
        }
        return '';

      case 'profile_saved':
        return 'Zmieniono dane profilu handlowca.';

      case 'company_register':
        if (!empty($meta['company_name'])) {
          return 'Firma: ' . self::clean_text($meta['company_name'], 160);
        }
        return '';

      case 'company_join':
        if (!empty($meta['company_name'])) {
          return 'Dolaczono do firmy: ' . self::clean_text($meta['company_name'], 160);
        }
        return '';

      case 'erp_message':
        return isset($meta['text']) ? self::clean_text($meta['text'], 280) : '';
    }

    return '';
  }

  private static function company_events($root_id, $limit){
    $root_id = (int) $root_id;
    $limit = (int) $limit;
    if ($root_id <= 0 || $limit <= 0) { return array(); }

    $members = self::company_accounts_map($root_id);
    if (empty($members)) { return array(); }
    $member_ids = array_keys($members);
    $member_set = array_fill_keys($member_ids, true);

    global $wpdb;
    $t = ZQOS_DB::tables();

    $fetch_limit = min(600, max(120, $limit * 8));
    $rows = $wpdb->get_results($wpdb->prepare(
      "SELECT id, account_id, offer_id, event, meta, created_at
       FROM {$t['events']}
       ORDER BY id DESC
       LIMIT %d",
      $fetch_limit
    ), ARRAY_A);
    if (!is_array($rows)) { $rows = array(); }

    $out = array();
    foreach ($rows as $row) {
      $account_id = isset($row['account_id']) ? (int) $row['account_id'] : 0;
      if ($account_id <= 0 || empty($member_set[$account_id])) { continue; }

      $event_key = sanitize_key((string) ($row['event'] ?? ''));
      if ($event_key === '') { continue; }

      $meta = self::event_meta($row['meta'] ?? null);
      $author = isset($members[$account_id]) ? $members[$account_id] : array(
        'id' => $account_id,
        'login' => '',
        'seller_name' => '',
      );

      $out[] = array(
        'id' => isset($row['id']) ? (int) $row['id'] : 0,
        'event' => $event_key,
        'event_label' => self::format_notification_label($event_key),
        'message' => self::format_notification_message($event_key, $meta),
        'meta' => $meta,
        'account_id' => $account_id,
        'account_login' => isset($author['login']) ? (string) $author['login'] : '',
        'account_name' => isset($author['seller_name']) ? (string) $author['seller_name'] : '',
        'offer_id' => isset($row['offer_id']) ? (int) $row['offer_id'] : 0,
        'created_at' => isset($row['created_at']) ? (string) $row['created_at'] : '',
      );

      if (count($out) >= $limit) {
        break;
      }
    }

    return $out;
  }
  private static function session_payload($account, $extra = array()){
    if (!is_array($account)) {
      return array_merge(array(
        'ok' => true,
        'authenticated' => false,
        'modules' => self::module_list(),
        'auth_entry' => self::auth_entry_modes(),
      ), is_array($extra) ? $extra : array());
    }

    $actor = ZQOS_Auth::actor_summary();
    if (!is_array($actor)) {
      $actor = array(
        'id' => (int) ($account['id'] ?? 0),
        'login' => (string) ($account['login'] ?? ''),
      );
    }

    $company = array(
      'root_id' => self::account_company_root_id($account),
      'role' => self::account_company_role($account),
      'name' => self::account_company_name($account),
    );

    $payload = array(
      'ok' => true,
      'authenticated' => true,
      'account' => $account,
      'actor' => $actor,
      'company' => $company,
      'can_switch' => (bool) ZQOS_Auth::actor_has_permission('super_admin'),
      'modules' => self::module_list(),
      'auth_entry' => self::auth_entry_modes(),
    );

    if (is_array($extra) && !empty($extra)) {
      $payload = array_merge($payload, $extra);
    }

    return $payload;
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
      'modules' => self::module_list(),
      'auth_entry' => self::auth_entry_modes(),
      'ts' => time(),
    ));
  }

  public static function route_session_get(){
    $acc = ZQOS_Auth::require_account();
    if (!$acc) {
      return rest_ensure_response(self::session_payload(null));
    }

    return rest_ensure_response(self::session_payload($acc));
  }

  public static function route_session_login(\WP_REST_Request $req){
    $login = self::normalize_login($req->get_param('login'));
    $password = (string) $req->get_param('password');

    if ($login === '') {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Niepoprawny login.'), 400);
    }

    if ($password === '') {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Brak hasla.'), 400);
    }

    $res = ZQOS_Auth::login($login, $password);
    if (empty($res['ok'])) {
      return new \WP_REST_Response(array(
        'ok' => false,
        'message' => isset($res['message']) ? (string) $res['message'] : 'Blad logowania.',
      ), 401);
    }

    if (!empty($res['token'])) {
      ZQOS_Auth::set_auth_cookie($res['token'], $res['expires_at'] ?? null);
      unset($res['token']);
    }

    $account = isset($res['account']) && is_array($res['account']) ? $res['account'] : ZQOS_Auth::require_account();
    return rest_ensure_response(self::session_payload($account));
  }

  public static function route_session_logout(){
    $res = ZQOS_Auth::logout();
    return rest_ensure_response(array(
      'ok' => !empty($res['ok']),
      'authenticated' => false,
      'modules' => self::module_list(),
      'auth_entry' => self::auth_entry_modes(),
    ));
  }

  public static function route_session_register_company(\WP_REST_Request $req){

    $company_name = self::clean_text($req->get_param('company_name'), 160);
    $admin_login = self::normalize_login($req->get_param('admin_login'));
    $password = self::normalize_password($req->get_param('password'));
    $admin_name = self::clean_text($req->get_param('admin_name'), 120);
    $admin_email = sanitize_email((string) $req->get_param('admin_email'));

    if ($company_name === '') {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Podaj nazwe firmy.'), 400);
    }

    if ($admin_login === '') {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Login musi miec 3-64 znaki: litery, cyfry, kropka, podkreslenie lub myslnik.'), 400);
    }

    if ($password === '') {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Haslo musi miec min. 8 znakow.'), 400);
    }

    if ($admin_email !== '' && !is_email($admin_email)) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Niepoprawny email.'), 400);
    }

    if (self::account_exists_by_login($admin_login)) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Ten login juz istnieje.'), 409);
    }

    $seller_name = $admin_name !== '' ? $admin_name : $admin_login;
    $profile = self::account_default_profile($seller_name, $admin_email, $company_name);
    $perms = self::account_default_perms($company_name, 0, 'owner', $seller_name, $admin_email);

    $account_id = self::insert_account($admin_login, $password, $perms, $profile);
    if ($account_id <= 0) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Nie udalo sie utworzyc konta firmy.'), 500);
    }

    $perms['company_root_id'] = $account_id;
    self::update_account_perms($account_id, $perms);

    $company_client_id = self::ensure_company_client($company_name, $seller_name, $admin_email);
    if ($company_client_id > 0) {
      self::assign_account_client($account_id, $company_client_id);
    }

    $join_code = self::create_join_code($account_id, $company_name, $company_client_id, $account_id, 30);

    $issued = self::issue_cookie_session($account_id);
    if (!$issued) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Konto utworzone, ale nie udalo sie uruchomic sesji. Zaloguj sie recznie.'), 500);
    }

    ZQOS_DB::log_event('company_register', $account_id, null, array(
      'company_name' => $company_name,
      'join_code' => $join_code['code'] ?? null,
    ));

    $account = ZQOS_Auth::get_account_public($account_id);
    $extra = array(
      'message' => 'Firma utworzona. Sesja aktywna.',
      'join_code' => is_array($join_code) ? ($join_code['code'] ?? '') : '',
    );

    return rest_ensure_response(self::session_payload($account, $extra));
  }

  public static function route_session_join_company(\WP_REST_Request $req){
    $join_code = self::normalize_join_code($req->get_param('join_code'));
    $login = self::normalize_login($req->get_param('login'));
    $password = self::normalize_password($req->get_param('password'));
    $full_name = self::clean_text($req->get_param('full_name'), 120);
    $email = sanitize_email((string) $req->get_param('email'));

    if ($join_code === '') {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Podaj poprawny kod dolaczenia.'), 400);
    }

    if ($login === '') {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Podaj poprawny login.'), 400);
    }

    if ($password === '') {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Haslo musi miec min. 8 znakow.'), 400);
    }

    if ($email !== '' && !is_email($email)) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Niepoprawny email.'), 400);
    }

    if (self::account_exists_by_login($login)) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Ten login juz istnieje.'), 409);
    }

    $invite = self::join_code_lookup($join_code);
    if (!is_array($invite)) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Kod dolaczenia jest niepoprawny lub wygasl.'), 404);
    }

    $root_id = (int) ($invite['root_id'] ?? 0);
    if ($root_id <= 0) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Kod dolaczenia nie ma poprawnej firmy.'), 400);
    }

    $root_acc = ZQOS_Auth::get_account_public($root_id);
    if (!is_array($root_acc)) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Firma nie istnieje.'), 404);
    }

    $company_name = self::clean_text($invite['company_name'] ?? '', 160);
    if ($company_name === '') {
      $company_name = self::account_company_name($root_acc);
    }

    $seller_name = $full_name !== '' ? $full_name : $login;
    $profile = self::account_default_profile($seller_name, $email, $company_name);
    $perms = self::account_default_perms($company_name, $root_id, 'member', $seller_name, $email);

    $account_id = self::insert_account($login, $password, $perms, $profile);
    if ($account_id <= 0) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Nie udalo sie utworzyc konta.'), 500);
    }

    $company_client_id = (int) ($invite['company_client_id'] ?? 0);
    if ($company_client_id <= 0) {
      $company_client_id = self::find_company_client_for_root($root_id);
    }
    if ($company_client_id > 0) {
      self::assign_account_client($account_id, $company_client_id);
    }

    $issued = self::issue_cookie_session($account_id);
    if (!$issued) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Konto utworzone, ale sesja nie zostala uruchomiona. Zaloguj sie recznie.'), 500);
    }

    ZQOS_DB::log_event('company_join', $account_id, null, array(
      'root_id' => $root_id,
      'join_code' => $join_code,
      'company_name' => $company_name,
    ));

    $account = ZQOS_Auth::get_account_public($account_id);
    return rest_ensure_response(self::session_payload($account, array(
      'message' => 'Dolaczono do firmy.',
    )));
  }

  public static function route_company_users(){
    $acc = ZQOS_Auth::require_account();
    if (!$acc) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Unauthorized'), 401);
    }

    $root_id = self::account_company_root_id($acc);
    if ($root_id <= 0) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Brak firmy przypisanej do konta.'), 400);
    }

    global $wpdb;
    $t = ZQOS_DB::tables();

    $rows = $wpdb->get_results("SELECT id, login, perms, profile, created_at, updated_at FROM {$t['accounts']} ORDER BY created_at DESC", ARRAY_A);
    if (!is_array($rows)) { $rows = array(); }

    $last_seen_rows = $wpdb->get_results("SELECT account_id, MAX(last_seen) AS last_seen FROM {$t['tokens']} GROUP BY account_id", ARRAY_A);
    $last_seen_map = array();
    if (is_array($last_seen_rows)) {
      foreach ($last_seen_rows as $r) {
        $aid = isset($r['account_id']) ? (int) $r['account_id'] : 0;
        if ($aid > 0) {
          $last_seen_map[$aid] = isset($r['last_seen']) ? (string) $r['last_seen'] : '';
        }
      }
    }

    $users = array();
    foreach ($rows as $row) {
      $id = isset($row['id']) ? (int) $row['id'] : 0;
      if ($id <= 0) { continue; }

      $perms = self::decode_json_array($row['perms'] ?? null);
      $company_root = isset($perms['company_root_id']) ? (int) $perms['company_root_id'] : $id;
      if ($company_root <= 0) { $company_root = $id; }

      if ($company_root !== $root_id) { continue; }

      $profile = self::decode_json_array($row['profile'] ?? null);
      $seller = isset($perms['seller']) && is_array($perms['seller']) ? $perms['seller'] : array();

      $users[] = array(
        'id' => $id,
        'login' => (string) ($row['login'] ?? ''),
        'role' => isset($perms['company_role']) ? (string) $perms['company_role'] : (($id === $root_id) ? 'owner' : 'member'),
        'seller_name' => self::clean_text($seller['name'] ?? '', 120),
        'seller_email' => sanitize_email((string) ($seller['email'] ?? '')),
        'created_at' => (string) ($row['created_at'] ?? ''),
        'updated_at' => (string) ($row['updated_at'] ?? ''),
        'last_seen' => isset($last_seen_map[$id]) ? (string) $last_seen_map[$id] : '',
        'time_total_sec' => (int) ($profile['time_total_sec'] ?? 0),
      );
    }

    usort($users, function($a, $b){
      $wa = ($a['role'] === 'owner') ? 0 : (($a['role'] === 'admin') ? 1 : 2);
      $wb = ($b['role'] === 'owner') ? 0 : (($b['role'] === 'admin') ? 1 : 2);
      if ($wa !== $wb) { return $wa - $wb; }
      $la = strtolower((string) ($a['login'] ?? ''));
      $lb = strtolower((string) ($b['login'] ?? ''));
      return strcmp($la, $lb);
    });

    return rest_ensure_response(array(
      'ok' => true,
      'company' => array(
        'root_id' => $root_id,
        'name' => self::account_company_name($acc),
        'role' => self::account_company_role($acc),
      ),
      'can_manage' => self::perm_company_manager(),
      'users' => $users,
      'current_account_id' => (int) ($acc['id'] ?? 0),
    ));
  }

  public static function route_company_join_codes_get(){
    $acc = ZQOS_Auth::require_account();
    if (!$acc) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Unauthorized'), 401);
    }

    $root_id = self::account_company_root_id($acc);
    if ($root_id <= 0) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Brak firmy.'), 400);
    }

    return rest_ensure_response(array(
      'ok' => true,
      'codes' => self::join_codes_for_root($root_id),
    ));
  }

  public static function route_company_join_codes_create(\WP_REST_Request $req){
    $acc = ZQOS_Auth::require_account();
    if (!$acc) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Unauthorized'), 401);
    }

    $root_id = self::account_company_root_id($acc);
    if ($root_id <= 0) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Brak firmy.'), 400);
    }

    $days = (int) $req->get_param('expires_days');
    if ($days <= 0) { $days = 30; }
    if ($days > 365) { $days = 365; }

    $company_name = self::account_company_name($acc);
    $client_id = self::find_company_client_for_root($root_id);

    $code = self::create_join_code($root_id, $company_name, $client_id, (int) ($acc['id'] ?? 0), $days);
    if (!is_array($code)) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Nie udalo sie utworzyc kodu.'), 500);
    }

    return rest_ensure_response(array(
      'ok' => true,
      'code' => array(
        'code' => (string) ($code['code'] ?? ''),
        'expires_at' => (string) ($code['expires_at'] ?? ''),
      ),
      'codes' => self::join_codes_for_root($root_id),
    ));
  }

  public static function route_messenger_messages_get(\WP_REST_Request $req){
    $acc = ZQOS_Auth::require_account();
    if (!$acc) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Unauthorized'), 401);
    }

    $root_id = self::account_company_root_id($acc);
    if ($root_id <= 0) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Brak firmy.'), 400);
    }

    $limit = (int) $req->get_param('limit');
    if ($limit <= 0) { $limit = 80; }
    if ($limit > 200) { $limit = 200; }

    $events = self::company_events($root_id, max(120, $limit * 4));
    $current_id = (int) ($acc['id'] ?? 0);
    $messages = array();
    foreach ($events as $evt) {
      if (($evt['event'] ?? '') !== 'erp_message') { continue; }
      $meta = isset($evt['meta']) && is_array($evt['meta']) ? $evt['meta'] : array();

      $text = isset($meta['text']) ? sanitize_textarea_field((string) $meta['text']) : '';
      $text = trim($text);
      if ($text === '') { continue; }

      $messages[] = array(
        'id' => (int) ($evt['id'] ?? 0),
        'text' => $text,
        'created_at' => (string) ($evt['created_at'] ?? ''),
        'account_id' => (int) ($evt['account_id'] ?? 0),
        'account_login' => (string) ($evt['account_login'] ?? ''),
        'account_name' => (string) ($evt['account_name'] ?? ''),
        'mine' => ((int) ($evt['account_id'] ?? 0) === $current_id),
      );

      if (count($messages) >= $limit) {
        break;
      }
    }

    $messages = array_reverse($messages);

    return rest_ensure_response(array(
      'ok' => true,
      'company' => array(
        'root_id' => $root_id,
        'name' => self::account_company_name($acc),
      ),
      'messages' => $messages,
      'current_account_id' => $current_id,
    ));
  }

  public static function route_messenger_messages_create(\WP_REST_Request $req){
    $acc = ZQOS_Auth::require_account();
    if (!$acc) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Unauthorized'), 401);
    }

    $root_id = self::account_company_root_id($acc);
    if ($root_id <= 0) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Brak firmy.'), 400);
    }

    $text = sanitize_textarea_field((string) $req->get_param('text'));
    $text = trim($text);
    if ($text === '') {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Wiadomosc nie moze byc pusta.'), 400);
    }
    if (strlen($text) > 1500) {
      $text = substr($text, 0, 1500);
    }

    $account_id = (int) ($acc['id'] ?? 0);
    ZQOS_DB::log_event('erp_message', $account_id, null, array(
      'text' => $text,
      'company_root_id' => $root_id,
    ));

    return rest_ensure_response(array(
      'ok' => true,
      'message' => 'Wiadomosc zapisana.',
    ));
  }

  public static function route_notifications_get(\WP_REST_Request $req){
    $acc = ZQOS_Auth::require_account();
    if (!$acc) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Unauthorized'), 401);
    }

    $root_id = self::account_company_root_id($acc);
    if ($root_id <= 0) {
      return new \WP_REST_Response(array('ok' => false, 'message' => 'Brak firmy.'), 400);
    }

    $limit = (int) $req->get_param('limit');
    if ($limit <= 0) { $limit = 60; }
    if ($limit > 200) { $limit = 200; }

    $events = self::company_events($root_id, $limit);
    $items = array();
    foreach ($events as $evt) {
      $items[] = array(
        'id' => (int) ($evt['id'] ?? 0),
        'event' => (string) ($evt['event'] ?? ''),
        'event_label' => (string) ($evt['event_label'] ?? ''),
        'message' => (string) ($evt['message'] ?? ''),
        'account_id' => (int) ($evt['account_id'] ?? 0),
        'account_login' => (string) ($evt['account_login'] ?? ''),
        'account_name' => (string) ($evt['account_name'] ?? ''),
        'offer_id' => (int) ($evt['offer_id'] ?? 0),
        'created_at' => (string) ($evt['created_at'] ?? ''),
      );
    }

    return rest_ensure_response(array(
      'ok' => true,
      'company' => array(
        'root_id' => $root_id,
        'name' => self::account_company_name($acc),
        'role' => self::account_company_role($acc),
      ),
      'notifications' => $items,
    ));
  }
}
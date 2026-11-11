# Vaultix Comprehensive Application Documentation

*Generated automatically with Playwright • 49 High-Resolution Screens & Action Dialogs in Logical Order*

## Table of Contents

### 1. Authentication & Security Access

- [01. Authentication - Login Screen (`/login`)](#screen-1)
- [02. Authentication - Registration Screen (`/register`)](#screen-2)
- [03. Authentication - Forgot Account Password (`/forgot-password`)](#screen-3)
- [04. Authentication - Forgot Master Password (`/forgot-master-password`)](#screen-4)
- [05. Master Password Verification Dialog (`Modal: Verify Master Password`)](#screen-5)

### 2. Dashboards & Core Tools

- [06. Security Dashboard Overview (`/dashboard`)](#screen-6)
- [07. Password Generator Tool Modal (`Modal: Password Generator`)](#screen-7)

### 3. Personal Vault & Credential Management

- [08. Personal Vault - All Items View (`/my-vault`)](#screen-8)
- [09. Add Item / New Password Modal Form (`Modal: Add Item`)](#screen-9)
- [10. Create Folder Dialog Modal (`Modal: Create Folder`)](#screen-10)
- [11. Personal Vault - Trash & Deleted Items (`/my-vault/trash`)](#screen-11)
- [12. Shared With Me - Credential List (`/shared-with-me`)](#screen-12)
- [13. Shared Login Item Details Modal (`Modal: Shared Login Details`)](#screen-13)

### 4. Company Vault (Organization Shared Vaults)

- [14. Company Vault - Server Logins Folder & History (`/vaults/company-vault`)](#screen-14)
- [15. Company Vault - Folder Permissions & Access Control (`Modal: Folder Permissions`)](#screen-15)
- [16. Company Vault - Folder History & Audit Timeline (`Modal: Folder History`)](#screen-16)
- [17. Company Vault - Folder Security Policy Modal (`Modal: Vault Policy`)](#screen-17)
- [18. Company Vault - Folder Actions & Export Menu (`Dropdown: Folder Actions`)](#screen-18)
- [19. Company Vault - Trash & Deleted Passwords (`/vaults/company-vault?tab=trash`)](#screen-19)

### 5. Activity Log & Audit Trail

- [20. Activity Log & Complete Audit Trail (`/activity-log`)](#screen-20)
- [21. Activity Log - Login History Tab (`/activity-log (Login History Tab)`)](#screen-21)
- [22. Activity Log - Unread Notifications Tab (`/activity-log (Unread Tab)`)](#screen-22)
- [23. Notifications Bell Menu Dropdown (`Header: Notifications Dropdown`)](#screen-23)

### 6. Security Center & Policies

- [24. Security - Password Health Audit Overview (`/security/password-health`)](#screen-24)
- [25. Security - Weak Passwords Audit Tab (`/security/password-health (Weak Tab)`)](#screen-25)
- [26. Security - Old Passwords Audit Tab (`/security/password-health (Old Tab)`)](#screen-26)
- [27. Security - Active Sessions & Devices (`/security/sessions`)](#screen-27)
- [28. Security - Two-Factor Authentication (2FA) Overview (`/security/2fa`)](#screen-28)
- [29. Security - 2FA Authenticator Setup (QR Code) (`/security/2fa (Setup Mode)`)](#screen-29)
- [30. Security - Vault Timeout Policy Settings (`/security/vault-timeout`)](#screen-30)
- [31. Security - Clipboard Security Settings (`/security/clipboard`)](#screen-31)

### 7. Team & User Administration

- [32. Team Management - Users & Roles Directory (`/team-management`)](#screen-32)
- [33. Team Management - Edit User Modal (`Modal: Edit User`)](#screen-33)
- [34. Team Management - Grant New Folder Access Modal (`Modal: Grant Folder Access`)](#screen-34)
- [35. Team Management - User Accessible Folders Modal (`Modal: Accessible Folders`)](#screen-35)
- [36. Team Management - Send Invitation Modal (`Modal: Send Invitation`)](#screen-36)
- [37. Team Management - Delete User Confirmation Dialog (`Dialog: Delete User`)](#screen-37)
- [38. Team Management - Invite Member Dedicated Page (`/team-management/invite`)](#screen-38)

### 8. Department Management

- [39. Department Management Overview (`/departments`)](#screen-39)
- [40. Department Details & Members Drawer (`Drawer: Department Details`)](#screen-40)
- [41. Create Department Dialog Modal (`Modal: Create Department`)](#screen-41)
- [42. Edit Department Dialog Modal (`Modal: Edit Department`)](#screen-42)
- [43. Create Sub-Department Dialog Modal (`Modal: Create Sub-department`)](#screen-43)
- [44. Add Department Members Modal (`Modal: Add Members`)](#screen-44)

### 9. Governance, Policies & Approvals

- [45. Organization Security Policies (`/admin/policies`)](#screen-45)
- [46. Admin Approvals - Pending Review Tab (`/admin/approvals (Pending Tab)`)](#screen-46)
- [47. Admin Approvals - My Initiated Requests Tab (`/admin/approvals?tab=my-requests`)](#screen-47)
- [48. Admin Approvals - Complete Approval History Tab (`/admin/approvals (History Tab)`)](#screen-48)

### 10. User Account & Profile Settings

- [49. User Profile - Personal Information (`/profile`)](#screen-49)

---

## Application Screens & Action Dialogs

### <a id="screen-1"></a>01. Authentication - Login Screen

- **Section:** 1. Authentication & Security Access
- **Route / Location:** `/login`
- **Description:** Primary login screen for user authentication using email and account password.
- **Screenshot:** `./screenshots/01_auth_login.png`

![Authentication - Login Screen](./screenshots/01_auth_login.png)

---

### <a id="screen-2"></a>02. Authentication - Registration Screen

- **Section:** 1. Authentication & Security Access
- **Route / Location:** `/register`
- **Description:** Account registration and onboarding screen for new team members.
- **Screenshot:** `./screenshots/02_auth_register.png`

![Authentication - Registration Screen](./screenshots/02_auth_register.png)

---

### <a id="screen-3"></a>03. Authentication - Forgot Account Password

- **Section:** 1. Authentication & Security Access
- **Route / Location:** `/forgot-password`
- **Description:** Password recovery flow to reset account login credentials.
- **Screenshot:** `./screenshots/03_auth_forgot_account_password.png`

![Authentication - Forgot Account Password](./screenshots/03_auth_forgot_account_password.png)

---

### <a id="screen-4"></a>04. Authentication - Forgot Master Password

- **Section:** 1. Authentication & Security Access
- **Route / Location:** `/forgot-master-password`
- **Description:** Emergency recovery flow for zero-knowledge vault master password reset.
- **Screenshot:** `./screenshots/04_auth_forgot_master_password.png`

![Authentication - Forgot Master Password](./screenshots/04_auth_forgot_master_password.png)

---

### <a id="screen-5"></a>05. Master Password Verification Dialog

- **Section:** 1. Authentication & Security Access
- **Route / Location:** `Modal: Verify Master Password`
- **Description:** Security prompt requiring Master Password confirmation before decrypting or revealing credentials.
- **Screenshot:** `./screenshots/05_auth_verify_master_password.png`

![Master Password Verification Dialog](./screenshots/05_auth_verify_master_password.png)

---

### <a id="screen-6"></a>06. Security Dashboard Overview

- **Section:** 2. Dashboards & Core Tools
- **Route / Location:** `/dashboard`
- **Description:** High-level security health, recent activity, score, and organization overview.
- **Screenshot:** `./screenshots/06_dashboard_security_overview.png`

![Security Dashboard Overview](./screenshots/06_dashboard_security_overview.png)

---

### <a id="screen-7"></a>07. Password Generator Tool Modal

- **Section:** 2. Dashboards & Core Tools
- **Route / Location:** `Modal: Password Generator`
- **Description:** Configurable strong password generator with length, uppercase, lowercase, numbers, and symbols sliders.
- **Screenshot:** `./screenshots/07_tool_password_generator.png`

![Password Generator Tool Modal](./screenshots/07_tool_password_generator.png)

---

### <a id="screen-8"></a>08. Personal Vault - All Items View

- **Section:** 3. Personal Vault & Credential Management
- **Route / Location:** `/my-vault`
- **Description:** Private vault containing all personal credentials, folders, and secrets.
- **Screenshot:** `./screenshots/08_vault_personal_all_items.png`

![Personal Vault - All Items View](./screenshots/08_vault_personal_all_items.png)

---

### <a id="screen-9"></a>09. Add Item / New Password Modal Form

- **Section:** 3. Personal Vault & Credential Management
- **Route / Location:** `Modal: Add Item`
- **Description:** Creation form for adding new passwords, cards, bank accounts, notes, and API tokens.
- **Screenshot:** `./screenshots/09_vault_add_item_modal.png`

![Add Item / New Password Modal Form](./screenshots/09_vault_add_item_modal.png)

---

### <a id="screen-10"></a>10. Create Folder Dialog Modal

- **Section:** 3. Personal Vault & Credential Management
- **Route / Location:** `Modal: Create Folder`
- **Description:** Dialog for creating custom organizational folders in the Personal Vault.
- **Screenshot:** `./screenshots/10_vault_create_folder_modal.png`

![Create Folder Dialog Modal](./screenshots/10_vault_create_folder_modal.png)

---

### <a id="screen-11"></a>11. Personal Vault - Trash & Deleted Items

- **Section:** 3. Personal Vault & Credential Management
- **Route / Location:** `/my-vault/trash`
- **Description:** Recycle bin allowing restoration or permanent deletion of discarded items and folders.
- **Screenshot:** `./screenshots/11_vault_personal_trash.png`

![Personal Vault - Trash & Deleted Items](./screenshots/11_vault_personal_trash.png)

---

### <a id="screen-12"></a>12. Shared With Me - Credential List

- **Section:** 3. Personal Vault & Credential Management
- **Route / Location:** `/shared-with-me`
- **Description:** Overview of all vault items and credentials shared by other team members.
- **Screenshot:** `./screenshots/12_vault_shared_with_me.png`

![Shared With Me - Credential List](./screenshots/12_vault_shared_with_me.png)

---

### <a id="screen-13"></a>13. Shared Login Item Details Modal

- **Section:** 3. Personal Vault & Credential Management
- **Route / Location:** `Modal: Shared Login Details`
- **Description:** Decrypted view of a shared credential showing login, password toggle, URL, notes, and tags.
- **Screenshot:** `./screenshots/13_vault_shared_item_details_modal.png`

![Shared Login Item Details Modal](./screenshots/13_vault_shared_item_details_modal.png)

---

### <a id="screen-14"></a>14. Company Vault - Server Logins Folder & History

- **Section:** 4. Company Vault (Organization Shared Vaults)
- **Route / Location:** `/vaults/company-vault`
- **Description:** Shared organization vault containing departmental and team credentials with audit history.
- **Screenshot:** `./screenshots/14_company_vault_folder_view.png`

![Company Vault - Server Logins Folder & History](./screenshots/14_company_vault_folder_view.png)

---

### <a id="screen-15"></a>15. Company Vault - Folder Permissions & Access Control

- **Section:** 4. Company Vault (Organization Shared Vaults)
- **Route / Location:** `Modal: Folder Permissions`
- **Description:** Granular access control management (Full Access, Read and Write, Read Only, Revoke).
- **Screenshot:** `./screenshots/15_company_vault_folder_permissions.png`

![Company Vault - Folder Permissions & Access Control](./screenshots/15_company_vault_folder_permissions.png)

---

### <a id="screen-16"></a>16. Company Vault - Folder History & Audit Timeline

- **Section:** 4. Company Vault (Organization Shared Vaults)
- **Route / Location:** `Modal: Folder History`
- **Description:** Detailed timestamped audit log of all password views, updates, autofills, and exports.
- **Screenshot:** `./screenshots/16_company_vault_folder_history_modal.png`

![Company Vault - Folder History & Audit Timeline](./screenshots/16_company_vault_folder_history_modal.png)

---

### <a id="screen-17"></a>17. Company Vault - Folder Security Policy Modal

- **Section:** 4. Company Vault (Organization Shared Vaults)
- **Route / Location:** `Modal: Vault Policy`
- **Description:** Policy enforcement: minimum strength score, max age limit, common password blocking, and allowed types.
- **Screenshot:** `./screenshots/17_company_vault_policy_modal.png`

![Company Vault - Folder Security Policy Modal](./screenshots/17_company_vault_policy_modal.png)

---

### <a id="screen-18"></a>18. Company Vault - Folder Actions & Export Menu

- **Section:** 4. Company Vault (Organization Shared Vaults)
- **Route / Location:** `Dropdown: Folder Actions`
- **Description:** Export options (CSV, Excel, Bitwarden, JSON), audit exports, import wizards, and folder management.
- **Screenshot:** `./screenshots/18_company_vault_folder_options_menu.png`

![Company Vault - Folder Actions & Export Menu](./screenshots/18_company_vault_folder_options_menu.png)

---

### <a id="screen-19"></a>19. Company Vault - Trash & Deleted Passwords

- **Section:** 4. Company Vault (Organization Shared Vaults)
- **Route / Location:** `/vaults/company-vault?tab=trash`
- **Description:** Company-level trash for restoring or permanently purging shared passwords and folders.
- **Screenshot:** `./screenshots/19_company_vault_trash.png`

![Company Vault - Trash & Deleted Passwords](./screenshots/19_company_vault_trash.png)

---

### <a id="screen-20"></a>20. Activity Log & Complete Audit Trail

- **Section:** 5. Activity Log & Audit Trail
- **Route / Location:** `/activity-log`
- **Description:** Unified organization audit trail tracking actions, logins, and system events with export support.
- **Screenshot:** `./screenshots/20_activity_log_overview.png`

![Activity Log & Complete Audit Trail](./screenshots/20_activity_log_overview.png)

---

### <a id="screen-21"></a>21. Activity Log - Login History Tab

- **Section:** 5. Activity Log & Audit Trail
- **Route / Location:** `/activity-log (Login History Tab)`
- **Description:** Dedicated record of user logins, IP addresses, client devices, and authentication outcomes.
- **Screenshot:** `./screenshots/21_activity_log_login_history_tab.png`

![Activity Log - Login History Tab](./screenshots/21_activity_log_login_history_tab.png)

---

### <a id="screen-22"></a>22. Activity Log - Unread Notifications Tab

- **Section:** 5. Activity Log & Audit Trail
- **Route / Location:** `/activity-log (Unread Tab)`
- **Description:** Filtered view displaying unread activity alerts, autofill logs, and critical security notices.
- **Screenshot:** `./screenshots/22_activity_log_unread_notifications_tab.png`

![Activity Log - Unread Notifications Tab](./screenshots/22_activity_log_unread_notifications_tab.png)

---

### <a id="screen-23"></a>23. Notifications Bell Menu Dropdown

- **Section:** 5. Activity Log & Audit Trail
- **Route / Location:** `Header: Notifications Dropdown`
- **Description:** Quick access notification dropdown in the top bar with mark-all-read and activity counts.
- **Screenshot:** `./screenshots/23_notifications_bell_dropdown.png`

![Notifications Bell Menu Dropdown](./screenshots/23_notifications_bell_dropdown.png)

---

### <a id="screen-24"></a>24. Security - Password Health Audit Overview

- **Section:** 6. Security Center & Policies
- **Route / Location:** `/security/password-health`
- **Description:** Comprehensive visual health analysis of vault passwords, distribution, and vulnerability score.
- **Screenshot:** `./screenshots/24_security_password_health_audit.png`

![Security - Password Health Audit Overview](./screenshots/24_security_password_health_audit.png)

---

### <a id="screen-25"></a>25. Security - Weak Passwords Audit Tab

- **Section:** 6. Security Center & Policies
- **Route / Location:** `/security/password-health (Weak Tab)`
- **Description:** Identifies credentials failing security score thresholds requiring immediate updates.
- **Screenshot:** `./screenshots/25_security_password_health_weak_tab.png`

![Security - Weak Passwords Audit Tab](./screenshots/25_security_password_health_weak_tab.png)

---

### <a id="screen-26"></a>26. Security - Old Passwords Audit Tab

- **Section:** 6. Security Center & Policies
- **Route / Location:** `/security/password-health (Old Tab)`
- **Description:** Lists stale passwords that have not been rotated within the recommended lifespan.
- **Screenshot:** `./screenshots/26_security_password_health_old_tab.png`

![Security - Old Passwords Audit Tab](./screenshots/26_security_password_health_old_tab.png)

---

### <a id="screen-27"></a>27. Security - Active Sessions & Devices

- **Section:** 6. Security Center & Policies
- **Route / Location:** `/security/sessions`
- **Description:** Session management display showing current and active logins with one-click revocation.
- **Screenshot:** `./screenshots/27_security_active_sessions.png`

![Security - Active Sessions & Devices](./screenshots/27_security_active_sessions.png)

---

### <a id="screen-28"></a>28. Security - Two-Factor Authentication (2FA) Overview

- **Section:** 6. Security Center & Policies
- **Route / Location:** `/security/2fa`
- **Description:** Status and configuration options for Authenticator Apps (TOTP) and Security Keys (WebAuthn).
- **Screenshot:** `./screenshots/28_security_2fa_overview.png`

![Security - Two-Factor Authentication (2FA) Overview](./screenshots/28_security_2fa_overview.png)

---

### <a id="screen-29"></a>29. Security - 2FA Authenticator Setup (QR Code)

- **Section:** 6. Security Center & Policies
- **Route / Location:** `/security/2fa (Setup Mode)`
- **Description:** Step-by-step TOTP setup interface with QR code scanner and secret key for authenticator apps.
- **Screenshot:** `./screenshots/29_security_2fa_setup_totp_qr.png`

![Security - 2FA Authenticator Setup (QR Code)](./screenshots/29_security_2fa_setup_totp_qr.png)

---

### <a id="screen-30"></a>30. Security - Vault Timeout Policy Settings

- **Section:** 6. Security Center & Policies
- **Route / Location:** `/security/vault-timeout`
- **Description:** Inactivity auto-lock policy configuration to secure abandoned browser sessions.
- **Screenshot:** `./screenshots/30_security_vault_timeout_settings.png`

![Security - Vault Timeout Policy Settings](./screenshots/30_security_vault_timeout_settings.png)

---

### <a id="screen-31"></a>31. Security - Clipboard Security Settings

- **Section:** 6. Security Center & Policies
- **Route / Location:** `/security/clipboard`
- **Description:** Automatic clipboard clearance configuration to prevent password leakage from paste buffers.
- **Screenshot:** `./screenshots/31_security_clipboard_settings.png`

![Security - Clipboard Security Settings](./screenshots/31_security_clipboard_settings.png)

---

### <a id="screen-32"></a>32. Team Management - Users & Roles Directory

- **Section:** 7. Team & User Administration
- **Route / Location:** `/team-management`
- **Description:** Directory of all organization members, their assigned roles, status, and administrative actions.
- **Screenshot:** `./screenshots/32_team_management_users_roles.png`

![Team Management - Users & Roles Directory](./screenshots/32_team_management_users_roles.png)

---

### <a id="screen-33"></a>33. Team Management - Edit User Modal

- **Section:** 7. Team & User Administration
- **Route / Location:** `Modal: Edit User`
- **Description:** User management dialog to modify member roles (Super Admin, Admin, Member) and active status.
- **Screenshot:** `./screenshots/33_team_management_edit_user_modal.png`

![Team Management - Edit User Modal](./screenshots/33_team_management_edit_user_modal.png)

---

### <a id="screen-34"></a>34. Team Management - Grant New Folder Access Modal

- **Section:** 7. Team & User Administration
- **Route / Location:** `Modal: Grant Folder Access`
- **Description:** Admin dialog to assign and grant team members specific folder permissions across Company Vaults.
- **Screenshot:** `./screenshots/34_team_management_grant_folder_access_modal.png`

![Team Management - Grant New Folder Access Modal](./screenshots/34_team_management_grant_folder_access_modal.png)

---

### <a id="screen-35"></a>35. Team Management - User Accessible Folders Modal

- **Section:** 7. Team & User Administration
- **Route / Location:** `Modal: Accessible Folders`
- **Description:** Inspection dialog showing all current folder permissions for a user with permission levels and revocation.
- **Screenshot:** `./screenshots/35_team_management_accessible_folders_modal.png`

![Team Management - User Accessible Folders Modal](./screenshots/35_team_management_accessible_folders_modal.png)

---

### <a id="screen-36"></a>36. Team Management - Send Invitation Modal

- **Section:** 7. Team & User Administration
- **Route / Location:** `Modal: Send Invitation`
- **Description:** Invitation modal allowing admins to invite new team members by email and assign starting roles.
- **Screenshot:** `./screenshots/36_team_management_send_invitation_modal.png`

![Team Management - Send Invitation Modal](./screenshots/36_team_management_send_invitation_modal.png)

---

### <a id="screen-37"></a>37. Team Management - Delete User Confirmation Dialog

- **Section:** 7. Team & User Administration
- **Route / Location:** `Dialog: Delete User`
- **Description:** Confirmation safeguard before removing a user account from the organization.
- **Screenshot:** `./screenshots/37_team_management_delete_user_confirm_dialog.png`

![Team Management - Delete User Confirmation Dialog](./screenshots/37_team_management_delete_user_confirm_dialog.png)

---

### <a id="screen-38"></a>38. Team Management - Invite Member Dedicated Page

- **Section:** 7. Team & User Administration
- **Route / Location:** `/team-management/invite`
- **Description:** Full-page interface for inviting new members and reviewing pending invitations.
- **Screenshot:** `./screenshots/38_team_management_invite_member_page.png`

![Team Management - Invite Member Dedicated Page](./screenshots/38_team_management_invite_member_page.png)

---

### <a id="screen-39"></a>39. Department Management Overview

- **Section:** 8. Department Management
- **Route / Location:** `/departments`
- **Description:** Department tree and organization structure with members and sub-department counts.
- **Screenshot:** `./screenshots/39_departments_management_overview.png`

![Department Management Overview](./screenshots/39_departments_management_overview.png)

---

### <a id="screen-40"></a>40. Department Details & Members Drawer

- **Section:** 8. Department Management
- **Route / Location:** `Drawer: Department Details`
- **Description:** Side drawer displaying department members, sub-departments, and department actions.
- **Screenshot:** `./screenshots/40_departments_details_members_drawer.png`

![Department Details & Members Drawer](./screenshots/40_departments_details_members_drawer.png)

---

### <a id="screen-41"></a>41. Create Department Dialog Modal

- **Section:** 8. Department Management
- **Route / Location:** `Modal: Create Department`
- **Description:** Creation dialog to establish new departments, parent hierarchies, and operational descriptions.
- **Screenshot:** `./screenshots/41_departments_create_department_modal.png`

![Create Department Dialog Modal](./screenshots/41_departments_create_department_modal.png)

---

### <a id="screen-42"></a>42. Edit Department Dialog Modal

- **Section:** 8. Department Management
- **Route / Location:** `Modal: Edit Department`
- **Description:** Management dialog to edit department names, parent associations, and descriptions.
- **Screenshot:** `./screenshots/42_departments_edit_department_modal.png`

![Edit Department Dialog Modal](./screenshots/42_departments_edit_department_modal.png)

---

### <a id="screen-43"></a>43. Create Sub-Department Dialog Modal

- **Section:** 8. Department Management
- **Route / Location:** `Modal: Create Sub-department`
- **Description:** Dialog for nesting a child department under an existing parent department.
- **Screenshot:** `./screenshots/43_departments_create_sub_department_modal.png`

![Create Sub-Department Dialog Modal](./screenshots/43_departments_create_sub_department_modal.png)

---

### <a id="screen-44"></a>44. Add Department Members Modal

- **Section:** 8. Department Management
- **Route / Location:** `Modal: Add Members`
- **Description:** User picker dialog with search filter to add existing team members to a department.
- **Screenshot:** `./screenshots/44_departments_add_members_modal.png`

![Add Department Members Modal](./screenshots/44_departments_add_members_modal.png)

---

### <a id="screen-45"></a>45. Organization Security Policies

- **Section:** 9. Governance, Policies & Approvals
- **Route / Location:** `/admin/policies`
- **Description:** Admin configuration for 2FA enforcement, dual admin approval requirements, and complexity rules.
- **Screenshot:** `./screenshots/45_admin_security_policies.png`

![Organization Security Policies](./screenshots/45_admin_security_policies.png)

---

### <a id="screen-46"></a>46. Admin Approvals - Pending Review Tab

- **Section:** 9. Governance, Policies & Approvals
- **Route / Location:** `/admin/approvals (Pending Tab)`
- **Description:** Super Admin approval queue for sensitive credential access, deletion, and policy override requests.
- **Screenshot:** `./screenshots/46_admin_approvals_pending_review.png`

![Admin Approvals - Pending Review Tab](./screenshots/46_admin_approvals_pending_review.png)

---

### <a id="screen-47"></a>47. Admin Approvals - My Initiated Requests Tab

- **Section:** 9. Governance, Policies & Approvals
- **Route / Location:** `/admin/approvals?tab=my-requests`
- **Description:** Personal view tracking approval requests submitted by the logged-in administrator.
- **Screenshot:** `./screenshots/47_admin_approvals_my_requests_tab.png`

![Admin Approvals - My Initiated Requests Tab](./screenshots/47_admin_approvals_my_requests_tab.png)

---

### <a id="screen-48"></a>48. Admin Approvals - Complete Approval History Tab

- **Section:** 9. Governance, Policies & Approvals
- **Route / Location:** `/admin/approvals (History Tab)`
- **Description:** Complete immutable audit log of all approved and rejected administrative requests.
- **Screenshot:** `./screenshots/48_admin_approvals_complete_history_tab.png`

![Admin Approvals - Complete Approval History Tab](./screenshots/48_admin_approvals_complete_history_tab.png)

---

### <a id="screen-49"></a>49. User Profile - Personal Information

- **Section:** 10. User Account & Profile Settings
- **Route / Location:** `/profile`
- **Description:** User account details, name, email verification status, and master password management.
- **Screenshot:** `./screenshots/49_user_profile_personal_info.png`

![User Profile - Personal Information](./screenshots/49_user_profile_personal_info.png)

---


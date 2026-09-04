const supabaseClient = window.supabase.createClient(
    "https://fqsigukfusoplfzvevlz.supabase.co",
    "sb_publishable_S_o8arC97cbzU9F_pUIDOw_7FW-Y_Rz"
);

let currentUser = null;


/* =========================================================
   DASHBOARD INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        const {
            data: {
                user
            },
            error
        } = await supabaseClient.auth.getUser();


        if (
            error ||
            !user
        ) {

            console.log(
                "No authenticated user. Redirecting to login."
            );

            window.location.replace(
                "login.html"
            );

            return;
        }


        currentUser = user;


        console.log(
            "Dashboard user:",
            currentUser
        );


        loadWelcomeMessage();

        await loadGroups();

        setupDashboardEvents();

    }
);

/* =========================================================
   WELCOME MESSAGE + USER AVATAR
========================================================= */

function loadWelcomeMessage() {

    const welcomeMessage =
        document.getElementById("welcomeMessage");

    const userAvatar =
        document.querySelector(".user-avatar");


    /* -----------------------------------------
       GET USER NAME
    ----------------------------------------- */

    const name =
        currentUser.user_metadata?.display_name?.trim();


    /* -----------------------------------------
       WELCOME MESSAGE
    ----------------------------------------- */

    if (name) {

        welcomeMessage.textContent =
            `Welcome, ${name}!`;

    } else {

        welcomeMessage.textContent =
            "Welcome!";

    }


    /* -----------------------------------------
       CREATE INITIALS
    ----------------------------------------- */

    let initials = "";


    if (name) {

        const nameParts =
            name.split(/\s+/).filter(Boolean);


        if (nameParts.length === 1) {

            // Example: "Kevin" → "K"
            initials =
                nameParts[0].charAt(0).toUpperCase();

        } else {

            // Example: "Kevin Fernandez" → "KF"
            initials =
                (
                    nameParts[0].charAt(0) +
                    nameParts[nameParts.length - 1].charAt(0)
                ).toUpperCase();

        }

    } else {

        /* -----------------------------------------
           FALLBACK TO EMAIL
        ----------------------------------------- */

        const email =
            currentUser.email || "";

        const emailName =
            email.split("@")[0];

        const emailParts =
            emailName
                .split(/[._-]+/)
                .filter(Boolean);


        if (emailParts.length >= 2) {

            initials =
                (
                    emailParts[0].charAt(0) +
                    emailParts[1].charAt(0)
                ).toUpperCase();

        } else {

            initials =
                emailName
                    .substring(0, 2)
                    .toUpperCase();

        }

    }


    /* -----------------------------------------
       DISPLAY AVATAR
    ----------------------------------------- */

    if (userAvatar) {

        userAvatar.textContent =
            initials || "?";

    }

}

/* =========================================================
   LOAD GROUPS
========================================================= */
async function loadGroups() {

    const groupsList =
        document.getElementById("groupsList");

    const { data, error } = await supabaseClient
        .from("groups")
        .select(`
            id,
            name,
            created_at
        `)
        .eq("created_by", currentUser.id)
        .order("created_at", {
            ascending: true
        });

    if (error) {

        console.error(
            "Could not load groups:",
            error
        );

        groupsList.innerHTML =
            "<p>Could not load your groups.</p>";

        return;
    }


    /* -----------------------------------------
       NO GROUPS
    ----------------------------------------- */

    if (!data || data.length === 0) {

        groupsList.innerHTML = `
            <div class="empty-groups">

                <h3>You don't have an expense group yet.</h3>

                <p>
                    Create your first group to start
                    tracking expenses.
                </p>

            </div>
        `;

        return;
    }


    /* -----------------------------------------
       DISPLAY GROUPS
    ----------------------------------------- */

    groupsList.innerHTML = "";

    data.forEach(function (group) {

        const groupElement =
            document.createElement("div");

        groupElement.className =
            "expense-group-card";

        groupElement.innerHTML = `

            <div class="expense-group-info">

                <h3>${escapeHtml(group.name)}</h3>

                <p>
                    Expense Group
                </p>

            </div>

            <div class="expense-group-actions">

                <button
                    class="open-group-btn"
                    data-group-id="${group.id}"
                >
                    Open →
                </button>

                <button
                    class="delete-group-btn"
                    data-group-id="${group.id}"
                    data-group-name="${escapeHtml(group.name)}"
                >
                    Delete 🗑️
                </button>

            </div>

        `;

        groupsList.appendChild(groupElement);

    });


    /* -----------------------------------------
       OPEN GROUP
    ----------------------------------------- */

    document
        .querySelectorAll(".open-group-btn")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                function () {

                    const groupId =
                        this.dataset.groupId;

                    sessionStorage.setItem(
                        "selectedGroupId",
                        groupId
                    );

                    window.location.href =
                        "expensesss.html";

                }
            );

        });


    /* -----------------------------------------
       DELETE GROUP
    ----------------------------------------- */

    document
        .querySelectorAll(".delete-group-btn")
        .forEach(function (button) {

            button.addEventListener(
                "click",
                async function () {

                    const groupId =
                        this.dataset.groupId;

                    const groupName =
                        this.dataset.groupName;


                    const confirmed =
                        confirm(
                            `Delete "${groupName}"?\n\n` +
                            `This will permanently delete this group` +
                            `This action cannot be undone.`
                        );


                    if (!confirmed) {
                        return;
                    }


                    await deleteGroup(groupId);

                }
            );

        });

}

/* =========================================================
   CREATE GROUP
========================================================= */

async function createGroup() {

    const input =
        document.getElementById("groupNameInput");

    const message =
        document.getElementById("groupMessage");

    const name =
        input.value.trim();


    if (!name) {

        message.textContent =
            "Please enter a group name.";

        return;
    }


    message.textContent =
        "Creating group...";


    const { data, error } =
        await supabaseClient
            .from("groups")
            .insert({

                name: name,

                created_by:
                    currentUser.id

            })
            .select()
            .single();


    if (error) {

        console.error(
            "Could not create group:",
            error
        );

        message.textContent =
            error.message;

        return;
    }


    console.log(
        "Group created:",
        data
    );


    input.value = "";

    message.textContent =
        "Group created successfully!";


    document
        .getElementById("createGroupForm")
        .style.display = "none";


    await loadGroups();

}

async function deleteGroup(groupId) {

    if (!currentUser) {

        alert(
            "You are not logged in."
        );

        return;
    }


    if (!groupId) {

        alert(
            "No group was selected."
        );

        return;
    }


    console.log(
        "Deleting group:",
        groupId
    );


    const { error } =
        await supabaseClient
            .from("groups")
            .delete()
            .eq("id", groupId)
            .eq("created_by", currentUser.id);


    if (error) {

        console.error(
            "Could not delete group:",
            error
        );

        alert(
            "Could not delete the group.\n\n" +
            error.message
        );

        return;
    }


    /* -----------------------------------------
       CLEAR SELECTED GROUP IF NEEDED
    ----------------------------------------- */

    const selectedGroupId =
        sessionStorage.getItem(
            "selectedGroupId"
        );

    if (
        selectedGroupId === groupId
    ) {

        sessionStorage.removeItem(
            "selectedGroupId"
        );

    }


    console.log(
        "Group deleted successfully."
    );


    await loadGroups();

}
/* =========================================================
   DASHBOARD EVENTS
========================================================= */

function setupDashboardEvents() {


    /* CREATE GROUP */

    document
        .getElementById("createGroupBtn")
        .addEventListener(
            "click",
            function () {

                document
                    .getElementById("createGroupForm")
                    .style.display = "block";

                document
                    .getElementById("groupNameInput")
                    .focus();

            }
        );


    /* CANCEL */

    document
        .getElementById("cancelGroupBtn")
        .addEventListener(
            "click",
            function () {

                document
                    .getElementById("createGroupForm")
                    .style.display = "none";

                document
                    .getElementById("groupNameInput")
                    .value = "";

                document
                    .getElementById("groupMessage")
                    .textContent = "";

            }
        );


    /* SAVE GROUP */

    document
        .getElementById("saveGroupBtn")
        .addEventListener(
            "click",
            createGroup
        );

}


/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHtml(value) {

    const div =
        document.createElement("div");

    div.textContent = value;

    return div.innerHTML;

}
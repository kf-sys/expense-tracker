/* =========================================================
   GROUP EXPENSE TRACKER
   VERSION 4
========================================================= */


/* =========================================================
   DATA
========================================================= */


const supabaseClient = window.supabase.createClient(
    "https://fqsigukfusoplfzvevlz.supabase.co",
    "sb_publishable_S_o8arC97cbzU9F_pUIDOw_7FW-Y_Rz"
);

let currentUser = null;
let currentGroupId = null;

/* ========================================================= AUTHENTICATION GUARD ========================================================= */ 
async function requireLogin() { 
    const { 
        data, 
        error } = 
            await supabaseClient.auth.getUser();

     if ( 
        error || 
        !data ||
        !data.user
     ) { 
        console.log( "No authenticated user. Redirecting to login." 
        
     );
     
     window.location.replace( 
    "login.html"
     ); 
    
     return false; 
    
    } return true;
 }

console.log("Supabase client created successfully.");

async function testSupabaseConnection() {

    const { data, error } = await supabaseClient
        .from("expenses")
        .select("*")
        .limit(1);

    if (error) {

        console.error(
            "Supabase connection failed:",
            error
        );

        return;

    }

    console.log(
        "Supabase connection successful!",
        data
    );

}

testSupabaseConnection();


async function loadSupabaseExpenses() {

    if (!currentGroupId) {

        console.error(
            "Cannot load expenses: no current group."
        );

        return;
    }


    /* =========================================================
       MAKE SURE MEMBERS ARE UP TO DATE
    ========================================================= */

    await loadGroupMembers();


    /* =========================================================
       LOAD EXPENSES
    ========================================================= */

    const {
        data: expenseRows,
        error: expenseError
    } = await supabaseClient
        .from("expenses")
        .select(`
            id,
            group_id,
            description,
            amount,
            date,
            category,
            paid_by_id,
            payment_method,
            credit_card_id,
            created_by,
            created_at,
            updated_at
        `)
        .eq(
            "group_id",
            currentGroupId
        )
        .order(
            "date",
            {
                ascending: false
            }
        );


    if (expenseError) {

        console.error(
            "Could not load expenses:",
            expenseError
        );

        return;
    }


    /* =========================================================
       LOAD EXPENSE SPLITS
    ========================================================= */

    const expenseIds =
        expenseRows.map(
            expense =>
                expense.id
        );


    let splitRows = [];


    if (expenseIds.length > 0) {

        const {
            data,
            error
        } = await supabaseClient
            .from("expense_splits")
            .select(`
                id,
                expense_id,
                member_id,
                amount
            `)
            .in(
                "expense_id",
                expenseIds
            );


        if (error) {

            console.error(
                "Could not load expense splits:",
                error
            );

            return;
        }


        splitRows =
            data || [];

    }


    console.log(
        "Loaded split rows:",
        splitRows
    );


    console.log(
        "Current members:",
        members
    );


    /* =========================================================
       CONVERT SUPABASE DATA TO APP FORMAT
    ========================================================= */

    expenses =
        expenseRows.map(
            expense => {

                const split = {};


                /*
                    Initialize every current member.
                */

                members.forEach(
                    member => {

                        split[
                            member.id
                        ] = 0;

                    }
                );


                /*
                    Add the actual saved splits.
                */

                splitRows
                    .filter(
                        row =>
                            row.expense_id ===
                            expense.id
                    )
                    .forEach(
                        row => {

                            split[
                                row.member_id
                            ] =
                                Number(
                                    row.amount
                                ) || 0;

                        }
                    );


                console.log(
                    "Expense split:",
                    expense.id,
                    split
                );


                return {

                    id:
                        expense.id,

                    description:
                        expense.description,

                    amount:
                        Number(
                            expense.amount
                        ) || 0,

                    date:
                        expense.date,

                    category:
                        expense.category ||
                        "Other",

                    paidById:
                        expense.paid_by_id,

                    paymentMethod:
                        expense.payment_method ||
                        "cash",

                    creditCardId:
                        expense.credit_card_id ||
                        null,

                    splits:
                        split

                };

            }
        );


    console.log(
        "Expenses loaded from Supabase:",
        expenses
    );

}
/* =========================================================
   LOAD CREDIT CARDS FROM SUPABASE
   STEP 10.1
========================================================= */

async function loadSupabaseCreditCards() {

    if (!currentGroupId) {

        console.error(
            "Cannot load credit cards: no current group."
        );

        return;

    }


    const {
        data,
        error
    } = await supabaseClient
        .from("credit_cards")
        .select(`
            id,
            group_id,
            owner_id,
            name,
            statement_day,
            due_day,
            created_at
        `)
        .eq(
            "group_id",
            currentGroupId
        )
        .order(
            "created_at",
            {
                ascending: true
            }
        );


    if (error) {

        console.error(
            "Could not load credit cards:",
            error
        );

        return;

    }


    /*
        Convert Supabase field names
        into the format already used
        by the existing JavaScript app.
    */

    creditCards =
        (data || []).map(
            card => ({

                id:
                    card.id,

                name:
                    card.name,

                ownerId:
                    card.owner_id,

                statementDay:
                    Number(
                        card.statement_day
                    ),

                dueDay:
                    Number(
                        card.due_day
                    )

            })
        );


    console.log(
        "Credit cards loaded from Supabase:",
        creditCards
    );

}

/* =========================================================
   LOAD BILL PAYMENTS FROM SUPABASE
   STEP 11.1
========================================================= */

async function loadSupabaseBillPayments() {

    if (!currentGroupId) {

        console.error(
            "Cannot load bill payments: no current group."
        );

        return false;

    }


    const {
        data,
        error
    } = await supabaseClient
        .from("bill_payments")
        .select(`
            id,
            group_id,
            credit_card_id,
            member_id,
            billing_year,
            billing_month,
            amount,
            created_at
        `)
        .eq(
            "group_id",
            currentGroupId
        );


    if (error) {

        console.error(
            "Could not load bill payments:",
            error
        );

        return false;

    }


    /*
        Convert Supabase rows into the
        existing billPayments structure.

        Existing structure:

        billPayments = {
            "cardId_year_month": {
                "memberId": amount
            }
        };
    */

    billPayments = {};


    (data || []).forEach(
        payment => {

            const billKey = [

                payment.credit_card_id,

                payment.billing_year,

                payment.billing_month

            ].join("_");


            if (
                !billPayments[billKey]
            ) {

                billPayments[billKey] = {};

            }


            billPayments[billKey][
                payment.member_id
            ] =
                Number(
                    payment.amount
                ) || 0;

        }
    );


    console.log(
        "Bill payments loaded from Supabase:",
        billPayments
    );


    return true;

}
/* =========================================================
   LOAD DEBT PAYMENTS FROM SUPABASE
   STEP 12.8 → EXPENSE-BASED
========================================================= */

async function loadSupabaseDebtPayments() {

    if (!currentGroupId) {

        console.error(
            "Cannot load debt payments: no current group."
        );

        return;

    }


    const {
        data,
        error
    } = await supabaseClient
        .from("debt_payments")
        .select(`
            id,
            group_id,
            expense_id,
            debtor_id,
            creditor_id,
            amount,
            paid,
            created_at
        `)
        .eq(
            "group_id",
            currentGroupId
        );


    if (error) {

        console.error(
            "Could not load debt payments:",
            error
        );

        return;

    }


    /*
        Clear existing local state.
    */

    debtPayments = {};


    /*
        Convert Supabase rows into
        the format used by the app.
    */

    (data || []).forEach(
        payment => {

            /*
                Ignore incomplete records.
            */

            if (
                !payment.expense_id ||
                !payment.debtor_id ||
                !payment.creditor_id
            ) {

                return;

            }


            /*
                Only paid records need
                to exist in the local
                paid-state object.
            */

            if (
                payment.paid
            ) {

                const key =
                    getDebtKey(
                        payment.expense_id,
                        payment.debtor_id,
                        payment.creditor_id
                    );


                debtPayments[key] =
                    true;

            }

        }
    );


    console.log(
        "Debt payments loaded from Supabase:",
        data
    );

}

async function testUserGroup() {

    const {
        data: {
            user
        }
    } = await supabaseClient.auth.getUser();

    if (!user) {

        console.log("No logged-in user.");
        return;

    }

    const {
        data,
        error
    } = await supabaseClient
        .from("group_members")
        .select("*")
        .eq("user_id", user.id);

    if (error) {

        console.error(
            "Could not find group membership:",
            error
        );

        return;

    }

    console.log(
        "USER GROUP MEMBERSHIP:",
        data
    );

}

// testUserGroup();

async function getCurrentUser() {

    try {

        /*
            Get the current Supabase session.
            Supabase will restore the saved session
            when the browser is reopened.
        */

        let {
            data: {
                session
            },
            error
        } =
            await supabaseClient.auth.getSession();


        if (error) {

            console.error(
                "Could not get Supabase session:",
                error
            );

            return null;

        }


        /*
            If there is no session, the user
            is not logged in.
        */

        if (!session) {

            console.error(
                "No active Supabase session."
            );

            return null;

        }


        /*
            Refresh the session when possible.

            This gives us a fresh access token
            instead of relying on an old JWT.
        */

        const refreshResult =
            await supabaseClient.auth.refreshSession();


        if (
            refreshResult.error
        ) {

            console.error(
                "Could not refresh Supabase session:",
                refreshResult.error
            );

            /*
                Fall back to the existing session.
                This prevents a temporary refresh
                problem from immediately destroying
                the app state.
            */

            currentUser =
                session.user;

        }
        else {

            currentUser =
                refreshResult
                    .data
                    .user;

        }


        if (!currentUser) {

            console.error(
                "No user found in Supabase session."
            );

            return null;

        }


        console.log(
            "Logged in user:",
            currentUser
        );


        return currentUser;

    }
    catch (error) {

        console.error(
            "Unexpected authentication error:",
            error
        );

        return null;

    }

}   

async function logoutUser() {

    const confirmed =
        confirm(
            "Are you sure you want to logout?"
        );

    if (!confirmed)
        return;


    const {
        error
    } = await supabaseClient.auth.signOut();


    if (error) {

        console.error(
            "Logout failed:",
            error
        );

        alert(
            "Could not logout.\n\n" +
            error.message
        );

        return;

    }


    currentUser = null;
    currentGroupId = null;


    window.location.replace(
        "login.html"
    );

}


async function getCurrentUserGroup() {

    if (!currentUser) {
        console.error("No logged-in user.");
        return null;
    }

    // Get the group selected from the dashboard
    const selectedGroupId =
        sessionStorage.getItem("selectedGroupId");

    if (selectedGroupId) {

        const { data, error } = await supabaseClient
            .from("groups")
            .select(`
                id,
                name,
                created_by
            `)
            .eq("id", selectedGroupId)
            .eq("created_by", currentUser.id)
            .maybeSingle();

        if (error) {

            console.error(
                "Could not load selected group:",
                error
            );

            return null;
        }

        if (!data) {

            console.error(
                "Selected group does not belong to this account."
            );

            return null;
        }

        currentGroupId = data.id;

        console.log("Selected group:", data);
        console.log("Current group ID:", currentGroupId);

        return data;
    }


    // No selected group
    console.error("No expense group selected.");

    return null;
}



async function loadGroupMembers() {

    if (!currentGroupId) {
        console.error("No current group ID.");
        return;
    }

    console.log(
        "Loading members for group:",
        currentGroupId
    );

    const {
        data,
        error
    } = await supabaseClient
        .from("group_members")
        .select(`
            id,
            group_id,
            user_id,
            display_name
        `)
        .eq("group_id", currentGroupId)
        .order("created_at", {
            ascending: true
        });

    if (error) {

        console.error(
            "Could not load group members:",
            error
        );

        return;
    }

    console.log(
        "Members returned from Supabase:",
        data
    );


    members = data.map(
        member => ({
            id: member.id,
            name: member.display_name,
            userId: member.user_id
        })
    );


    console.log(
        "MEMBERS ARRAY:",
        members
    );


    populateMemberDropdowns();

}

async function initializeSupabaseApp() {

    try {

        const user = await getCurrentUser();

        if (!user) {

            console.error("No logged-in user.");

            window.location.href = "login.html";

            return false;
        }

        // Store the current user
        currentUser = user;

        // Find the selected expense group
        const group = await getCurrentUserGroup();

        // User must select a group from the dashboard
        if (!group) {

            console.error("No expense group selected.");

            window.location.href = "dashboard.html";

            return false;
        }

        // Load members and expenses
        await loadGroupMembers();

        await loadSupabaseExpenses();

        console.log("Supabase app initialized.");

        console.log("User ID:", currentUser.id);

        console.log("Current Group ID:", currentGroupId);

        console.log("Members:", members);

        console.log("Expenses:", expenses);

        return true;

    } catch (error) {

        console.error(
            "Supabase initialization error:",
            error
        );

        return false;
    }
}

const STORAGE_KEY = "groupExpenseTrackerV4";

let members = [];

let creditCards = [];

let expenses = [];

let billPayments = {};

let debtPayments = {};

let editingExpenseId = null;

let currentSplit = {};

/* =========================================================
   CREDIT CARD STATEMENT HISTORY UI
========================================================= */

let paidHistoryExpanded = false;

let paidHistorySearch = "";

let paidHistoryCardFilter = "";

let paidHistoryMemberFilter = "";

let paidHistoryYearFilter = "";

let expandedPaidBills = {};

/* =========================================================
   ID
========================================================= */

function generateId(prefix = "id") {

    return (
        prefix +
        "_" +
        Date.now() +
        "_" +
        Math.random()
            .toString(36)
            .slice(2, 9)
    );

}


/* =========================================================
   MONEY
========================================================= */

function money(amount) {

    return "₱" +
        Number(amount || 0).toLocaleString(
            "en-PH",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent =
        value ?? "";

    return div.innerHTML;

}


/* =========================================================
   DATE
========================================================= */

function todayString() {

    const date =
        new Date();

    return [
        date.getFullYear(),

        String(
            date.getMonth() + 1
        ).padStart(2, "0"),

        String(
            date.getDate()
        ).padStart(2, "0")

    ].join("-");
}


function formatDate(dateString) {

    if (!dateString)
        return "-";

    const date =
        new Date(
            dateString +
            "T00:00:00"
        );

    return date.toLocaleDateString(
        "en-PH",
        {
            year: "numeric",
            month: "long",
            day: "numeric"
        }
    );
}


function formatDueDay(day) {

    const d =
        Number(day);

    if (
        d >= 11 &&
        d <= 13
    ) {

        return d + "th";

    }

    switch (d % 10) {

        case 1:
            return d + "st";

        case 2:
            return d + "nd";

        case 3:
            return d + "rd";

        default:
            return d + "th";
    }
}


/* =========================================================
   PAYMENT METHOD
========================================================= */

function getPaymentMethodName(method) {

    switch (method) {

        case "credit_card":
            return "💳 Credit Card";

        case "cash":
            return "💵 Cash";

        case "gcash":
            return "📱 GCash";

        case "maya":
            return "📱 Maya";

        case "bank_transfer":
            return "🏦 Bank Transfer";

        case "other_ewallet":
            return "📱 Other E-Wallet";

        default:
            return "💵 Cash";
    }
}


/* =========================================================
   STORAGE
========================================================= */

function saveAllData() {

    const data = {

        version: 4,

        members,

        creditCards,

        expenses,

        billPayments,

        debtPayments

    };

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
    );

}


/* =========================================================
   LOAD / MIGRATION
========================================================= */

function loadData() {

    const modern =
        localStorage.getItem(
            STORAGE_KEY
        );

    if (modern) {

        try {

            const data =
                JSON.parse(modern);

            members =
                Array.isArray(data.members)
                    ? data.members
                    : [];

            creditCards =
                Array.isArray(data.creditCards)
                    ? data.creditCards
                    : [];

            expenses =
                Array.isArray(data.expenses)
                    ? data.expenses
                    : [];

            billPayments =
                data.billPayments || {};

            debtPayments =
                data.debtPayments || {};

            normalizeData();

            return;

        }
        catch(error) {

            console.error(
                "Could not load V4 data",
                error
            );

        }

    }


    /*
        Try old application storage.
    */

    const oldMembers =
        localStorage.getItem(
            "groupMembers"
        );

    const oldCards =
        localStorage.getItem(
            "groupCreditCards"
        );

    const oldExpenses =
        localStorage.getItem(
            "groupExpenses"
        );

    const oldBillPayments =
        localStorage.getItem(
            "groupBillPayments"
        );

    const oldDebtPayments =
        localStorage.getItem(
            "groupDebtPayments"
        );


    if (
        oldMembers ||
        oldCards ||
        oldExpenses
    ) {

        migrateOldData({

            members:
                safeParse(
                    oldMembers,
                    [
                        "You",
                        "John",
                        "Maria",
                        "Peter"
                    ]
                ),

            creditCards:
                safeParse(
                    oldCards,
                    []
                ),

            expenses:
                safeParse(
                    oldExpenses,
                    []
                ),

            billPayments:
                safeParse(
                    oldBillPayments,
                    {}
                ),

            debtPayments:
                safeParse(
                    oldDebtPayments,
                    {}
                )

        });

        return;

    }


    /*
        Fresh installation.
    */

    members = [

        {
            id: generateId("member"),
            name: "You"
        },

        {
            id: generateId("member"),
            name: "John"
        },

        {
            id: generateId("member"),
            name: "Maria"
        },

        {
            id: generateId("member"),
            name: "Peter"
        }

    ];

    creditCards = [];

    expenses = [];

    billPayments = {};

    debtPayments = {};

    saveAllData();

}


function safeParse(value, fallback) {

    try {

        return value
            ? JSON.parse(value)
            : fallback;

    }
    catch {

        return fallback;

    }

}


/* =========================================================
   OLD DATA MIGRATION
========================================================= */

function migrateOldData(old) {

    /*
        Convert members.

        Old:
        ["You", "John", ...]

        New:
        [{id, name}, ...]
    */

    const oldNames =
        Array.isArray(old.members)
            ? old.members
            : [];


    members =
        oldNames.map(
            name => ({

                id:
                    generateId("member"),

                name:
                    String(name)

            })
        );


    /*
        Safety.
    */

    if (!members.length) {

        members = [

            {
                id:
                    generateId("member"),

                name:
                    "You"
            }

        ];

    }


    function memberIdFromName(name) {

        const member =
            members.find(
                m =>
                    m.name === name
            );

        return member
            ? member.id
            : null;
    }


    /*
        Cards.
    */

    creditCards =
        (old.creditCards || []).map(
            card => ({

                id:
                    card.id ||
                    generateId("card"),

                name:
                    String(
                        card.name ||
                        "Credit Card"
                    ),

                ownerId:
                    memberIdFromName(
                        card.owner
                    ) ||
                    members[0].id,

                statementDay:
                    Number(
                        card.statementDay ||
                        1
                    ),

                dueDay:
                    Number(
                        card.dueDay ||
                        30
                    )

            })
        );


    /*
        Expenses.
    */

    expenses =
        (old.expenses || []).map(
            expense => {

                const split = {};

                const oldSplit =
                    expense.splits || {};


                members.forEach(
                    member => {

                        split[
                            member.id
                        ] =
                            Number(
                                oldSplit[
                                    member.name
                                ] || 0
                            );

                    }
                );


                let paymentMethod =
                    expense.paymentMethod;


                if (!paymentMethod) {

                    paymentMethod =
                        expense.creditCardId
                            ? "credit_card"
                            : "cash";

                }


                return {

                    id:
                        expense.id ||
                        generateId("expense"),

                    description:
                        String(
                            expense.description ||
                            ""
                        ),

                    amount:
                        Number(
                            expense.amount ||
                            0
                        ),

                    date:
                        expense.date ||
                        todayString(),

                    category:
                        expense.category ||
                        "Other",

                    paidById:
                        memberIdFromName(
                            expense.paidBy
                        ) ||
                        members[0].id,

                    paymentMethod,

                    creditCardId:
                        paymentMethod ===
                        "credit_card"
                            ? expense.creditCardId ||
                              null
                            : null,

                    split

                };

            }
        );


    /*
        Convert old bill-payment keys.

        Old key:
        cardId_year_month

        old member names:
        { John: true }

        New:
        { memberId: amount }
    */

    const convertedBillPayments = {};


    Object.entries(
        old.billPayments || {}
    ).forEach(
        (
            [key, values]
        ) => {

            convertedBillPayments[key] = {};


            Object.entries(
                values || {}
            ).forEach(
                (
                    [name, value]
                ) => {

                    const member =
                        members.find(
                            m =>
                                m.name ===
                                name
                        );


                    if (member) {

                        /*
                            Old boolean payment
                            becomes full amount later.
                        */

                        convertedBillPayments[
                            key
                        ][
                            member.id
                        ] =
                            value
                                ? true
                                : false;

                    }

                }
            );

        }
    );


    billPayments =
        convertedBillPayments;


    /*
        Old debt keys:

        debtor___creditor

        Convert names to IDs.
    */

    const convertedDebtPayments = {};


    Object.entries(
        old.debtPayments || {}
    ).forEach(
        (
            [key, value]
        ) => {

            const parts =
                key.split("___");


            if (
                parts.length !== 2
            )
                return;


            const debtor =
                memberIdFromName(
                    parts[0]
                );

            const creditor =
                memberIdFromName(
                    parts[1]
                );


            if (
                debtor &&
                creditor
            ) {

                convertedDebtPayments[
                    getDebtKey(
                        debtor,
                        creditor
                    )
                ] = Boolean(
                    value
                );

            }

        }
    );


    debtPayments =
        convertedDebtPayments;


    normalizeData();

    saveAllData();


    alert(
        "Your existing data was migrated to the new member-ID system."
    );

}


/* =========================================================
   NORMALIZE DATA
========================================================= */

function normalizeData() {

    /*
        Normalize members.
    */

    members =
        members
            .map(
                member => {

                    if (
                        typeof member ===
                        "string"
                    ) {

                        return {

                            id:
                                generateId(
                                    "member"
                                ),

                            name:
                                member

                        };

                    }


                    return {

                        id:
                            member.id ||
                            generateId(
                                "member"
                            ),

                        name:
                            String(
                                member.name ||
                                "Unnamed"
                            )

                    };

                }
            );


    /*
        Normalize cards.
    */

    creditCards =
        creditCards.map(
            card => {

                let ownerId =
                    card.ownerId;


                /*
                    Support accidentally
                    imported old owner field.
                */

                if (
                    !ownerId &&
                    card.owner
                ) {

                    const owner =
                        members.find(
                            m =>
                                m.name ===
                                card.owner
                        );

                    ownerId =
                        owner?.id ||
                        members[0]?.id;

                }


                return {

                    id:
                        card.id ||
                        generateId("card"),

                    name:
                        String(
                            card.name ||
                            "Credit Card"
                        )
                            .trim()
                            .toUpperCase(),

                    ownerId:
                        ownerId ||
                        members[0]?.id ||
                        null,

                    statementDay:
                        clamp(
                            Number(
                                card.statementDay ||
                                1
                            ),
                            1,
                            31
                        ),

                    dueDay:
                        clamp(
                            Number(
                                card.dueDay ||
                                30
                            ),
                            1,
                            31
                        )

                };

            }
        );


    /*
        Normalize expenses.
    */

    expenses =
        expenses.map(
            expense => {

                let paidById =
                    expense.paidById;


                if (
                    !paidById &&
                    expense.paidBy
                ) {

                    paidById =
                        members.find(
                            m =>
                                m.name ===
                                expense.paidBy
                        )?.id;

                }


                const split = {};


                /*
                    New split format.
                */

                if (
                    expense.splits
                ) {

                    Object.entries(
                        expense.splits
                    ).forEach(
                        (
                            [key, value]
                        ) => {

                            const member =
                                members.find(
                                    m =>
                                        m.id ===
                                        key
                                );


                            if (member) {

                                split[key] =
                                    Number(
                                        value
                                    ) || 0;

                                return;

                            }


                            /*
                                Old name-based
                                split.
                            */

                            const oldMember =
                                members.find(
                                    m =>
                                        m.name ===
                                        key
                                );


                            if (oldMember) {

                                split[
                                    oldMember.id
                                ] =
                                    Number(
                                        value
                                    ) || 0;

                            }

                        }
                    );

                }


                members.forEach(
                    member => {

                        if (
                            split[
                                member.id
                            ] === undefined
                        ) {

                            split[
                                member.id
                            ] = 0;

                        }

                    }
                );


                let paymentMethod =
                    expense.paymentMethod;


                if (!paymentMethod) {

                    paymentMethod =
                        expense.creditCardId
                            ? "credit_card"
                            : "cash";

                }


                return {

                    id:
                        expense.id ||
                        generateId("expense"),

                    description:
                        String(
                            expense.description ||
                            ""
                        ),

                    amount:
                        Number(
                            expense.amount ||
                            0
                        ),

                    date:
                        expense.date ||
                        todayString(),

                    category:
                        expense.category ||
                        "Other",

                    paidById:
                        paidById ||
                        members[0]?.id,

                    paymentMethod,

                    creditCardId:
                        paymentMethod ===
                        "credit_card"
                            ? expense.creditCardId ||
                              null
                            : null,

                    split

                };

            }
        );


    /*
        Normalize partial bill payments.

        New format:

        billPayments[key][memberId] =
            amountPaid

        Old boolean values are retained
        and interpreted when rendered.
    */

    if (
        !billPayments ||
        typeof billPayments !==
        "object"
    ) {

        billPayments = {};

    }


    if (
        !debtPayments ||
        typeof debtPayments !==
        "object"
    ) {

        debtPayments = {};

    }

}


/* =========================================================
   CLAMP
========================================================= */

function clamp(
    value,
    min,
    max
) {

    return Math.min(
        Math.max(
            value,
            min
        ),
        max
    );

}


/* =========================================================
   MEMBER HELPERS
========================================================= */

function getMember(
    id
) {

    return members.find(
        member =>
            member.id === id
    );

}


function getMemberName(
    id
) {

    return (
        getMember(id)?.name ||
        "Unknown Member"
    );

}


function memberExists(
    id
) {

    return Boolean(
        getMember(id)
    );

}


/* =========================================================
   SETTINGS
========================================================= */

function openSettings() {

    renderSettings();

    document
        .getElementById(
            "settingsModal"
        )
        .classList.add("open");

}


function closeSettings() {

    document
        .getElementById(
            "settingsModal"
        )
        .classList.remove("open");

}


function renderSettings() {

    renderSettingsMembers();

    populateMemberDropdowns();

    renderSettingsCards();

}


/* =========================================================
   MEMBERS
========================================================= */

function renderSettingsMembers() {

    const container =
        document.getElementById(
            "settingsMembers"
        );


    container.innerHTML = "";


    members.forEach(
        (
            member,
            index
        ) => {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "settings-member-row";


            row.innerHTML = `

                <label>
                    Member ${index + 1}
                </label>

                <input
                    type="text"
                    class="member-input"
                    data-id="${escapeHTML(member.id)}"
                    value="${escapeHTML(member.name)}"
                >

                <button
                    class="danger small-btn"
                    onclick="removeMember('${escapeHTML(member.id)}')"
                >
                    Remove
                </button>

            `;


            container.appendChild(
                row
            );

        }
    );

}


function addMemberRow() {

    const container =
        document.getElementById(
            "settingsMembers"
        );

    const row =
        document.createElement(
            "div"
        );

    row.className =
        "settings-member-row";

    row.innerHTML = `

        <label>
            New Member
        </label>

        <input
            type="text"
            class="member-input"
            data-id=""
            value=""
            placeholder="Enter member name"
        >

        <button
            class="danger small-btn"
            onclick="this.parentElement.remove()"
        >
            Remove
        </button>

    `;

    container.appendChild(row);

}

async function removeMember(
    memberId
) {

    if (!currentUser) {

        alert(
            "You are not logged in."
        );

        return;

    }


    if (!currentGroupId) {

        alert(
            "No group is currently selected."
        );

        return;

    }


    if (
        members.length <= 1
    ) {

        alert(
            "You need at least one member."
        );

        return;

    }


    const member =
        getMember(
            memberId
        );


    if (!member)
        return;


    /*
        Do not silently destroy
        historical financial data.

        Check whether this member is
        already referenced by expenses.
    */

    const hasExpenses =
        expenses.some(
            expense =>
                expense.paidById ===
                    memberId ||

                Number(
                    expense.splits?.[
                        memberId
                    ] || 0
                ) > 0
        );


    const ownsCard =
        creditCards.some(
            card =>
                card.ownerId ===
                memberId
        );


    if (
        hasExpenses ||
        ownsCard
    ) {

        alert(
            `${member.name} cannot be removed because they are referenced by existing expenses or credit cards.\n\n` +
            "Rename the member instead to preserve historical data."
        );

        return;

    }


    if (
        !confirm(
            `Remove ${member.name}?`
        )
    ) {

        return;

    }


    try {

        /*
            Delete member from Supabase.
        */

        const {
            error
        } = await supabaseClient
            .from("group_members")
            .delete()
            .eq(
                "id",
                memberId
            )
            .eq(
                "group_id",
                currentGroupId
            );


        if (error) {

            console.error(
                "Could not remove member:",
                error
            );


            alert(
                "Could not remove member.\n\n" +
                error.message
            );

            return;

        }


        /*
            Reload members from Supabase.
        */

        await loadGroupMembers();


        /*
            Refresh the application.
        */

        renderAll();

        renderSettings();


        alert(
            `${member.name} was removed successfully.`
        );

    }
    catch (error) {

        console.error(
            "Unexpected error removing member:",
            error
        );


        alert(
            "Could not remove member.\n\n" +
            error.message
        );

    }

}


async function saveMembers() {

    if (!currentUser) {
        alert("You are not logged in.");
        return;
    }

    if (!currentGroupId) {
        alert("No group is currently selected.");
        return;
    }

    const inputs =
        document.querySelectorAll(".member-input");

    const names =
        Array.from(inputs).map(
            input => input.value.trim()
        );


    /* =========================================================
       VALIDATE NAMES
    ========================================================= */

    if (names.some(name => !name)) {

        alert("All member names are required.");
        return;

    }


    /* =========================================================
       PREVENT DUPLICATE NAMES
    ========================================================= */

    const duplicate =
        names.some(
            (name, index) =>
                names.findIndex(
                    other =>
                        other.toLowerCase() ===
                        name.toLowerCase()
                ) !== index
        );

    if (duplicate) {

        alert("Member names must be unique.");
        return;

    }


    try {

        /* =====================================================
           SAVE EACH MEMBER
        ===================================================== */

        for (const input of inputs) {

            const memberId =
                input.dataset.id;

            const name =
                input.value.trim();


            /* =================================================
               EXISTING MEMBER
            ================================================= */

            if (memberId) {

                const { error } =
                    await supabaseClient
                        .from("group_members")
                        .update({
                            display_name: name
                        })
                        .eq("id", memberId)
                        .eq("group_id", currentGroupId);

                if (error) {
                    throw error;
                }

            }


            /* =================================================
               NEW MEMBER
            ================================================= */

            else {

                const { error } =
                    await supabaseClient
                        .from("group_members")
                        .insert({
                            group_id: currentGroupId,
                            user_id: null,
                            display_name: name
                        });

                if (error) {
                    throw error;
                }

            }

        }


        /* =====================================================
           IMPORTANT:
           RELOAD MEMBERS FROM SUPABASE
        ===================================================== */

        await loadGroupMembers();


        console.log(
            "Updated members after saving:",
            members
        );


        /* =====================================================
           REFRESH MEMBER-BASED UI
        ===================================================== */

        populateMemberDropdowns();

        renderAll();

        renderSettings();


        alert(
            "Members saved successfully."
        );


    }
    catch (error) {

        console.error(
            "Could not save members:",
            error
        );

        alert(
            "Could not save members.\n\n" +
            error.message
        );

    }

}



/* =========================================================
   DROPDOWNS
========================================================= */

function populateMemberDropdowns() {

    const paidBy =
        document.getElementById("paidBy");

    const owner =
        document.getElementById("newCardOwner");


    /* =====================================================
       PAID BY DROPDOWN
    ===================================================== */

    if (paidBy) {

        const oldPaid =
            paidBy.value;

        paidBy.innerHTML = "";


        members.forEach(member => {

            const option =
                new Option(
                    member.name,
                    member.id
                );

            paidBy.appendChild(option);

        });


        if (memberExists(oldPaid)) {

            paidBy.value =
                oldPaid;

        }
        else if (members.length > 0) {

            paidBy.value =
                members[0].id;

        }

    }


    /* =====================================================
       CREDIT CARD OWNER DROPDOWN
    ===================================================== */

    if (owner) {

        const oldOwner =
            owner.value;

        owner.innerHTML = "";


        members.forEach(member => {

            const option =
                new Option(
                    member.name,
                    member.id
                );

            owner.appendChild(option);

        });


        if (memberExists(oldOwner)) {

            owner.value =
                oldOwner;

        }
        else if (members.length > 0) {

            owner.value =
                members[0].id;

        }

    }


    /* =====================================================
       EXPENSE FILTER
    ===================================================== */

    renderExpenseFilterMembers();

}




/* =========================================================
   CREDIT CARDS
========================================================= */
/* =========================================================
   ADD CREDIT CARD
   STEP 10.2 → SUPABASE INSERT
========================================================= */

async function addCreditCard() {

    if (!currentUser) {

        alert(
            "You are not logged in."
        );

        return;

    }


    if (!currentGroupId) {

        alert(
            "No group is currently selected."
        );

        return;

    }


    const name =
        document
            .getElementById(
                "newCardName"
            )
            .value
            .trim()
            .toUpperCase();


    const ownerId =
        document
            .getElementById(
                "newCardOwner"
            )
            .value;


    const statementDay =
        Number(
            document
                .getElementById(
                    "newCardStatementDay"
                )
                .value
        );


    const dueDay =
        Number(
            document
                .getElementById(
                    "newCardDueDay"
                )
                .value
        );


    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!name) {

        alert(
            "Please enter a credit card name."
        );

        return;

    }


    if (!ownerId) {

        alert(
            "Please select an owner."
        );

        return;

    }


    if (
        statementDay < 1 ||
        statementDay > 31
    ) {

        alert(
            "Statement day must be between 1 and 31."
        );

        return;

    }


    if (
        dueDay < 1 ||
        dueDay > 31
    ) {

        alert(
            "Due day must be between 1 and 31."
        );

        return;

    }


    /* =====================================================
       INSERT CREDIT CARD INTO SUPABASE
    ===================================================== */

    const {
        data: card,
        error
    } = await supabaseClient
        .from("credit_cards")
        .insert({

            group_id:
                currentGroupId,

            owner_id:
                ownerId,

            name:
                name,

            statement_day:
                statementDay,

            due_day:
                dueDay

        })
        .select()
        .single();


    if (error) {

        console.error(
            "Could not save credit card:",
            error
        );


        alert(
            "Could not save credit card.\n\n" +
            error.message
        );


        return;

    }


    /* =====================================================
       UPDATE LOCAL ARRAY
       SO THE UI REFRESHES IMMEDIATELY
    ===================================================== */

    creditCards.push({

        id:
            card.id,

        name:
            card.name,

        ownerId:
            card.owner_id,

        statementDay:
            Number(
                card.statement_day
            ),

        dueDay:
            Number(
                card.due_day
            )

    });


    /* =====================================================
       RESET FORM
    ===================================================== */

    document.getElementById(
        "newCardName"
    ).value =
        "";


    document.getElementById(
        "newCardStatementDay"
    ).value =
        "";


    document.getElementById(
        "newCardDueDay"
    ).value =
        "";


    /* =====================================================
       REFRESH UI
    ===================================================== */

    renderAll();

    renderSettings();


    console.log(
        "Credit card saved to Supabase:",
        card
    );

}

/* =========================================================
   DELETE CREDIT CARD
   STEP 10.4 → SUPABASE DELETE
========================================================= */

async function deleteCreditCard(id) {

    if (!currentUser) {

        alert(
            "You are not logged in."
        );

        return;

    }


    if (!currentGroupId) {

        alert(
            "No group is currently selected."
        );

        return;

    }


    /*
        Check whether the card is being
        used by an existing expense.
    */

    const used =
        expenses.some(
            expense =>
                String(
                    expense.creditCardId
                ) ===
                String(id)
        );


    if (used) {

        alert(
            "This card is being used by an expense. Delete or edit those expenses first."
        );

        return;

    }


    /*
        Find the card locally.
    */

    const card =
        creditCards.find(
            c =>
                String(c.id) ===
                String(id)
        );


    if (!card)
        return;


    /*
        Confirm deletion.
    */

    if (
        !confirm(
            `Delete ${card.name}?`
        )
    ) {

        return;

    }


    /*
        Delete from Supabase.
    */

    const {
        error
    } = await supabaseClient
        .from("credit_cards")
        .delete()
        .eq(
            "id",
            id
        )
        .eq(
            "group_id",
            currentGroupId
        );


    if (error) {

        console.error(
            "Could not delete credit card:",
            error
        );


        alert(
            "Could not delete credit card.\n\n" +
            error.message
        );


        return;

    }


    /*
        Remove from the local array
        so the UI updates immediately.
    */

    creditCards =
        creditCards.filter(
            c =>
                String(c.id) !==
                String(id)
        );


    /*
        Refresh UI.
    */

    renderAll();

    renderSettings();


    console.log(
        "Credit card deleted from Supabase:",
        id
    );

}



function renderSettingsCards() {

    const container =
        document.getElementById(
            "settingsCreditCards"
        );


    container.innerHTML =
        "";


    if (
        creditCards.length === 0
    ) {

        container.innerHTML = `

            <div class="empty">
                No credit cards added yet.
            </div>

        `;

        return;

    }


    creditCards.forEach(
        card => {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "settings-card-row";


            row.innerHTML = `

                <div class="settings-card-info">

                    <strong>
                        💳
                        ${escapeHTML(card.name)}
                    </strong>

                    <div class="bill-info">

                        Owner:
                        ${escapeHTML(
                            getMemberName(
                                card.ownerId
                            )
                        )}

                        <br>

                        Statement:
                        ${formatDueDay(
                            card.statementDay
                        )}

                        &nbsp; • &nbsp;

                        Due:
                        ${formatDueDay(
                            card.dueDay
                        )}

                    </div>

                </div>


                <div>

                    <button
                        class="danger small-btn"
                        onclick="deleteCreditCard('${escapeHTML(card.id)}')"
                    >
                        Delete
                    </button>

                </div>

            `;


            container.appendChild(
                row
            );

        }
    );

}

/* =========================================================
   LOAD CREDIT CARDS
   STEP 10.5 → SUPABASE SELECT
========================================================= */

async function loadSupabaseCreditCards() {

    if (!currentGroupId) {

        console.error(
            "Cannot load credit cards: no current group."
        );

        return;

    }


    const {
        data,
        error
    } = await supabaseClient
        .from("credit_cards")
        .select(`
            id,
            group_id,
            owner_id,
            name,
            statement_day,
            due_day,
            created_at
        `)
        .eq(
            "group_id",
            currentGroupId
        )
        .order(
            "created_at",
            {
                ascending: true
            }
        );


    if (error) {

        console.error(
            "Could not load credit cards:",
            error
        );

        return;

    }


    /*
        Convert Supabase rows into
        the format already used by
        the existing application.
    */

    creditCards =
        (data || []).map(
            card => ({

                id:
                    card.id,

                name:
                    card.name,

                ownerId:
                    card.owner_id,

                statementDay:
                    Number(
                        card.statement_day
                    ),

                dueDay:
                    Number(
                        card.due_day
                    )

            })
        );


    console.log(
        "Credit cards loaded from Supabase:",
        creditCards
    );

}

function populateCreditCardDropdown() {

    const select =
        document.getElementById(
            "creditCard"
        );


    if (!select)
        return;


    const oldValue =
        select.value;


    select.innerHTML = `

        <option value="">
            Select Credit Card
        </option>

    `;


    creditCards.forEach(
        card => {

            const owner =
                getMemberName(
                    card.ownerId
                );


            const option =
                new Option(
                    `${card.name} — ${owner}`,
                    card.id
                );


            select.appendChild(
                option
            );

        }
    );


    if (
        creditCards.some(
            card =>
                String(card.id) ===
                String(oldValue)
        )
    ) {

        select.value =
            oldValue;

    }

}


/* =========================================================
   PAYMENT METHOD UI
========================================================= */

function updatePaymentMethodUI() {

    const method =
        document.getElementById(
            "paymentMethod"
        ).value;


    const field =
        document.getElementById(
            "creditCardField"
        );


    if (
        method ===
        "credit_card"
    ) {

        field.style.display =
            "block";

    }
    else {

        field.style.display =
            "none";

        document.getElementById(
            "creditCard"
        ).value =
            "";

    }

}


/* =========================================================
   SPLITTING
========================================================= */

function splitEqually() {

    const amount =
        Number(
            document.getElementById(
                "amount"
            ).value
        );


    if (
        !amount ||
        amount <= 0
    ) {

        alert(
            "Enter the expense amount first."
        );

        return;

    }


    if (
        !members.length
    )
        return;


    const base =
        Math.floor(
            (
                amount /
                members.length
            ) *
            100
        ) / 100;


    currentSplit = {};


    members.forEach(
        member => {

            currentSplit[
                member.id
            ] = base;

        }
    );


    const total =
        Object.values(
            currentSplit
        ).reduce(
            (
                sum,
                value
            ) =>
                sum +
                Number(value),
            0
        );


    const difference =
        Number(
            (
                amount -
                total
            ).toFixed(2)
        );


    const last =
        members[
            members.length - 1
        ];


    currentSplit[
        last.id
    ] =
        Number(
            (
                currentSplit[
                    last.id
                ] +
                difference
            ).toFixed(2)
        );


    renderSplitInputs();

}


function showCustomSplit() {

    const amount =
        Number(
            document.getElementById(
                "amount"
            ).value
        );


    if (
        !amount ||
        amount <= 0
    ) {

        alert(
            "Enter the expense amount first."
        );

        return;

    }


    if (
        Object.keys(
            currentSplit
        ).length === 0
    ) {

        splitEqually();

        return;

    }


    renderSplitInputs();

}


function renderSplitInputs() {

    const container =
        document.getElementById(
            "splitContainer"
        );


    container.innerHTML =
        "";


    members.forEach(
        member => {

            if (
                currentSplit[
                    member.id
                ] === undefined
            ) {

                currentSplit[
                    member.id
                ] = 0;

            }


            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "split-row";


            row.innerHTML = `

                <label>
                    ${escapeHTML(
                        member.name
                    )}
                </label>

                <input
                    type="number"
                    class="split-input"
                    data-member-id="${escapeHTML(member.id)}"
                    value="${Number(
                        currentSplit[
                            member.id
                        ]
                    ).toFixed(2)}"
                    min="0"
                    step="0.01"
                >

            `;


            const input =
                row.querySelector(
                    ".split-input"
                );


            input.addEventListener(
                "input",
                function() {

                    updateSplitValue(
                        this
                    );

                }
            );


            container.appendChild(
                row
            );

        }
    );


    updateSplitTotal();

}


function updateSplitValue(
    input
) {

    const memberId =
        input.dataset.memberId;


    currentSplit[
        memberId
    ] =
        Number(
            input.value
        ) || 0;


    updateSplitTotal();

}


function updateSplitTotal() {

    const amount =
        Number(
            document.getElementById(
                "amount"
            ).value
        ) || 0;


    const total =
        members.reduce(
            (
                sum,
                member
            ) =>
                sum +
                Number(
                    currentSplit[
                        member.id
                    ] || 0
                ),
            0
        );


    const difference =
        Number(
            (
                amount -
                total
            ).toFixed(2)
        );


    const element =
        document.getElementById(
            "splitTotal"
        );


    element.textContent =
        "Split Total: " +
        money(total);


    if (
        Math.abs(
            difference
        ) > 0.01
    ) {

        element.style.color =
            "#f87171";


        element.textContent +=
            " — Difference: " +
            money(
                Math.abs(
                    difference
                )
            );

    }
    else {

        element.style.color =
            "#22c55e";

    }

}


/* =========================================================
   SAVE EXPENSE
   STEP 7 — SUPABASE
========================================================= */

async function saveExpense() {

    const description =
        document
            .getElementById("description")
            .value
            .trim();


    const amount =
        Number(
            document.getElementById("amount").value
        );


    const date =
        document.getElementById(
            "expenseDate"
        ).value;


    const category =
        document.getElementById(
            "category"
        ).value;


    const paidById =
        document.getElementById(
            "paidBy"
        ).value;


    const paymentMethod =
        document.getElementById(
            "paymentMethod"
        ).value;


    const creditCardId =
        paymentMethod === "credit_card"
            ? document.getElementById(
                "creditCard"
            ).value
            : null;


    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!description) {

        alert(
            "Please enter a description."
        );

        return;

    }


    if (
        !amount ||
        amount <= 0
    ) {

        alert(
            "Please enter a valid amount."
        );

        return;

    }


    if (!date) {

        alert(
            "Please select the expense date."
        );

        return;

    }


    if (!paidById) {

        alert(
            "Please select who paid."
        );

        return;

    }


    if (
        paymentMethod === "credit_card" &&
        !creditCardId
    ) {

        alert(
            "Please select a credit card."
        );

        return;

    }


    /* =====================================================
       BUILD SPLIT
    ===================================================== */

    const split = {};


    let splitTotal = 0;


    members.forEach(
        member => {

            const share =
                Number(
                    currentSplit[
                        member.id
                    ] || 0
                );


            split[
                member.id
            ] = share;


            splitTotal += share;

        }
    );


    if (
        Math.abs(
            splitTotal -
            amount
        ) > 0.01
    ) {

        alert(
            "The split amounts must equal the expense amount.\n\n" +
            "Expense: " +
            money(amount) +
            "\n" +
            "Split: " +
            money(splitTotal)
        );

        return;

    }


    /* =====================================================
       STEP 7
       NEW EXPENSE → SUPABASE
    ===================================================== */

    if (!editingExpenseId) {

        if (!currentUser) {

            alert(
                "You are not logged in."
            );

            return;

        }


        if (!currentGroupId) {

            alert(
                "No group is currently selected."
            );

            return;

        }


        /*
            Insert the main expense.
        */

        const {
            data: expense,
            error: expenseError
        } = await supabaseClient
            .from("expenses")
            .insert({

                group_id:
                    currentGroupId,

                description:
                    description,

                amount:
                    amount,

                date:
                    date,

                category:
                    category,

                paid_by_id:
                    paidById,

                payment_method:
                    paymentMethod,

                credit_card_id:
                    creditCardId,

                created_by:
                    currentUser.id

            })
            .select()
            .single();


        if (expenseError) {

            console.error(
                "Could not save expense:",
                expenseError
            );


            alert(
                "Could not save expense.\n\n" +
                expenseError.message
            );


            return;

        }


        /*
            Build expense_splits rows.
        */

        const splitRows =
            members
                .map(
                    member => ({

                        expense_id:
                            expense.id,

                        member_id:
                            member.id,

                        amount:
                            Number(
                                split[
                                    member.id
                                ] || 0
                            )

                    })
                )
                /*
                    Don't create unnecessary
                    zero-value split rows.
                */
                .filter(
                    row =>
                        row.amount > 0
                );


        /*
            Insert the splits.
        */

        if (
            splitRows.length > 0
        ) {

            const {
                error: splitError
            } = await supabaseClient
                .from("expense_splits")
                .insert(
                    splitRows
                );


            if (splitError) {

                console.error(
                    "Could not save expense splits:",
                    splitError
                );


                /*
                    The expense was created but
                    its splits failed.

                    Remove the expense so we
                    don't leave orphaned data.
                */

                await supabaseClient
                    .from("expenses")
                    .delete()
                    .eq(
                        "id",
                        expense.id
                    );


                alert(
                    "The expense could not be saved completely.\n\n" +
                    splitError.message
                );


                return;

            }

        }
    

        /*
            Update the local array so the
            existing UI immediately reflects
            the new Supabase data.
        */
await loadSupabaseExpenses();


console.log(
    "Expense saved to Supabase:",
    expense
);


resetExpenseForm();

renderAll();


return;
}
    /* =====================================================
       STEP 8
       EDIT EXISTING EXPENSE → SUPABASE
    ===================================================== */

    if (editingExpenseId) {

        if (!currentUser) {

            alert(
                "You are not logged in."
            );

            return;

        }


        if (!currentGroupId) {

            alert(
                "No group is currently selected."
            );

            return;

        }


        /*
            Find the existing expense.
        */

        const existingExpense =
            expenses.find(
                expense =>
                    expense.id ===
                    editingExpenseId
            );


        if (!existingExpense) {

            alert(
                "The expense could not be found."
            );

            return;

        }


        /*
            Update the main expense.
        */

        const {
            data: updatedExpense,
            error: expenseError
        } = await supabaseClient
            .from("expenses")
            .update({

                description:
                    description,

                amount:
                    amount,

                date:
                    date,

                category:
                    category,

                paid_by_id:
                    paidById,

                payment_method:
                    paymentMethod,

                credit_card_id:
                    creditCardId,

                updated_at:
                    new Date().toISOString()

            })
            .eq(
                "id",
                editingExpenseId
            )
            .eq(
                "group_id",
                currentGroupId
            )
            .select()
            .single();


        if (expenseError) {

            console.error(
                "Could not update expense:",
                expenseError
            );


            alert(
                "Could not update expense.\n\n" +
                expenseError.message
            );


            return;

        }


        /*
            Remove the old expense splits.
        */

        const {
            error: deleteSplitError
        } = await supabaseClient
            .from("expense_splits")
            .delete()
            .eq(
                "expense_id",
                editingExpenseId
            );


        if (deleteSplitError) {

            console.error(
                "Could not remove old expense splits:",
                deleteSplitError
            );


            alert(
                "The expense was updated, but the old expense splits could not be removed.\n\n" +
                deleteSplitError.message
            );


            return;

        }


        /*
            Build the new split rows.
        */

        const splitRows =
            members
                .map(
                    member => ({

                        expense_id:
                            editingExpenseId,

                        member_id:
                            member.id,

                        amount:
                            Number(
                                split[
                                    member.id
                                ] || 0
                            )

                    })
                )
                .filter(
                    row =>
                        row.amount > 0
                );


        /*
            Insert the new splits.
        */

        if (
            splitRows.length > 0
        ) {

            const {
                error: splitError
            } = await supabaseClient
                .from("expense_splits")
                .insert(
                    splitRows
                );


            if (splitError) {

                console.error(
                    "Could not save updated expense splits:",
                    splitError
                );


                alert(
                    "The expense was updated, but the new splits could not be saved.\n\n" +
                    splitError.message
                );


                return;

            }

        }


        /*
            Update the local expenses array
            so the existing UI immediately
            reflects the changes.
        */

        const index =
            expenses.findIndex(
                expense =>
                    expense.id ===
                    editingExpenseId
            );


        if (
            index !== -1
        ) {

            expenses[index] = {

                id:
                    updatedExpense.id,

                description:
                    updatedExpense.description,

                amount:
                    Number(
                        updatedExpense.amount
                    ),

                date:
                    updatedExpense.date,

                category:
                    updatedExpense.category ||
                    "Other",

                paidById:
                    updatedExpense.paid_by_id,

                paymentMethod:
                    updatedExpense.payment_method ||
                    "cash",

                creditCardId:
                    updatedExpense.credit_card_id ||
                    null,

                splits:

                {
                    ...split
                }

            };

        }


        console.log(
            "Expense updated in Supabase:",
            updatedExpense
        );


        /*
            Exit edit mode and refresh UI.
        */

        resetExpenseForm();

        renderAll();


        return;

    }
}

/* =========================================================
   EDIT EXPENSE
========================================================= */

function editExpense(
    id
) {

    const expense =
        expenses.find(
            e =>
                e.id === id
        );


    if (!expense)
        return;


    editingExpenseId =
        expense.id;


    document.getElementById(
        "description"
    ).value =
        expense.description;


    document.getElementById(
        "amount"
    ).value =
        expense.amount;


    document.getElementById(
        "expenseDate"
    ).value =
        expense.date;


    document.getElementById(
        "category"
    ).value =
        expense.category;


    document.getElementById(
        "paidBy"
    ).value =
        expense.paidById;


    document.getElementById(
        "paymentMethod"
    ).value =
        expense.paymentMethod ||
        "cash";


    updatePaymentMethodUI();


    if (
        expense.paymentMethod ===
        "credit_card"
    ) {

        document.getElementById(
            "creditCard"
        ).value =
            expense.creditCardId ||
            "";

    }


    currentSplit =
        {
            ...(expense.splits || {})
        };


    members.forEach(
        member => {

            if (
                currentSplit[
                    member.id
                ] === undefined
            ) {

                currentSplit[
                    member.id
                ] = 0;

            }

        }
    );


    renderSplitInputs();


    document.getElementById(
        "saveExpenseButton"
    ).textContent =
        "Update Expense";


    document.getElementById(
        "cancelEditButton"
    ).classList.remove(
        "hidden"
    );


    window.scrollTo({

        top: 0,

        behavior: "smooth"

    });

}

/* =========================================================
   DELETE EXPENSE
   STEP 9 → SUPABASE DELETE
========================================================= */

async function deleteExpense(
    id
) {

    if (!currentUser) {

        alert(
            "You are not logged in."
        );

        return;

    }


    if (!currentGroupId) {

        alert(
            "No group is currently selected."
        );

        return;

    }


    /*
        Find the expense locally first.
    */

    const expense =
        expenses.find(
            e =>
                e.id === id
        );
        
    if (!expense) {

        alert(
            "The expense could not be found."
        );

        return;

    }

    /*
    Remember the credit-card billing
    information before deleting the expense.
*/

let affectedBill = null;

if (
    expense.paymentMethod ===
    "credit_card"
) {

    const card =
        getCardForExpense(
            expense
        );

    if (card) {

        const period =
            getBillingPeriod(
                expense,
                card
            );

        affectedBill = {

            cardId:
                card.id,

            year:
                period.year,

            month:
                period.month

        };

    }

}

    /*
        Confirm deletion.
    */

    const confirmed =
        confirm(
            "Are you sure you want to delete this expense?\n\n" +
            expense.description +
            "\n" +
            money(expense.amount)
        );


    if (!confirmed)
        return;


    /*
        Delete the expense splits first.
    */

    const {
        error: splitError
    } = await supabaseClient
        .from("expense_splits")
        .delete()
        .eq(
            "expense_id",
            id
        );


    if (splitError) {

        console.error(
            "Could not delete expense splits:",
            splitError
        );


        alert(
            "The expense could not be deleted completely.\n\n" +
            splitError.message
        );


        return;

    }


    /*
        Delete the main expense.
    */

    const {
        error: expenseError
    } = await supabaseClient
        .from("expenses")
        .delete()
        .eq(
            "id",
            id
        )
        .eq(
            "group_id",
            currentGroupId
        );


    if (expenseError) {

        console.error(
            "Could not delete expense:",
            expenseError
        );


        alert(
            "The expense could not be deleted.\n\n" +
            expenseError.message
        );


        return;

    }


    /*
        Remove the expense from the
        local JavaScript array.
    */

    expenses =
        expenses.filter(
            expense =>
                expense.id !== id
        );


    /*
        If the deleted expense was
        currently being edited, reset
        the form.
    */

    if (
        editingExpenseId === id
    ) {

        resetExpenseForm();

    }

/*
    If this was a credit-card expense,
    make sure existing payments do not
    exceed the new statement balances.
*/

if (affectedBill) {

    const affectedCard =
        creditCards.find(
            card =>
                String(card.id) ===
                String(affectedBill.cardId)
        );


    if (affectedCard) {

        const affectedPeriod =
            getBillingPeriod(
                {
                    date:
                        expense.date
                },
                affectedCard
            );


        const affectedBillKey =
            getBillKey(
                affectedCard,
                affectedPeriod
            );


        const remainingBill =
            getBillGroups().find(
                bill =>
                    bill.key ===
                    affectedBillKey
            );


        if (remainingBill) {

            for (
                const member of members
            ) {

                const memberTotal =
                    getMemberBillAmount(
                        remainingBill,
                        member.id
                    );


                const paidAmount =
                    getMemberPaymentAmount(
                        remainingBill,
                        member.id
                    );


                /*
                    If the recorded payment is
                    greater than the new share,
                    cap it at the new share.
                */

                if (
                    paidAmount >
                    memberTotal
                ) {

                    if (
                        memberTotal <=
                        0
                    ) {

                        await supabaseClient
                            .from("bill_payments")
                            .delete()
                            .eq(
                                "group_id",
                                currentGroupId
                            )
                            .eq(
                                "credit_card_id",
                                affectedBill.cardId
                            )
                            .eq(
                                "member_id",
                                member.id
                            )
                            .eq(
                                "billing_year",
                                affectedBill.year
                            )
                            .eq(
                                "billing_month",
                                affectedBill.month
                            );

                    }
                    else {

                        await supabaseClient
                            .from("bill_payments")
                            .update({

                                amount:
                                    Number(
                                        memberTotal.toFixed(2)
                                    )

                            })
                            .eq(
                                "group_id",
                                currentGroupId
                            )
                            .eq(
                                "credit_card_id",
                                affectedBill.cardId
                            )
                            .eq(
                                "member_id",
                                member.id
                            )
                            .eq(
                                "billing_year",
                                affectedBill.year
                            )
                            .eq(
                                "billing_month",
                                affectedBill.month
                            );

                    }

                }

            }

        }

    }

}

    /*
        Refresh the existing UI.
    */

    renderAll();


    console.log(
        "Expense deleted from Supabase:",
        id
    );

}

/* =========================================================
   RESET EXPENSE FORM
========================================================= */

function resetExpenseForm() {

    editingExpenseId =
        null;


    document.getElementById(
        "description"
    ).value =
        "";


    document.getElementById(
        "amount"
    ).value =
        "";


    document.getElementById(
        "expenseDate"
    ).value =
        todayString();


    document.getElementById(
        "category"
    ).value =
        "Food";


    document.getElementById(
        "paidBy"
    ).value =
        members[0]?.id ||
        "";


    /*
        CASH is now the default.
    */

    document.getElementById(
        "paymentMethod"
    ).value =
        "cash";


    document.getElementById(
        "creditCard"
    ).value =
        "";


    updatePaymentMethodUI();


    currentSplit = {};


    document.getElementById(
        "splitContainer"
    ).innerHTML =
        "";


    document.getElementById(
        "splitTotal"
    ).textContent =
        "Split Total: ₱0.00";


    document.getElementById(
        "splitTotal"
    ).style.color =
        "#94a3b8";


    document.getElementById(
        "saveExpenseButton"
    ).textContent =
        "+ Add Expense";


    document.getElementById(
        "cancelEditButton"
    ).classList.add(
        "hidden"
    );

}


function cancelEdit() {

    resetExpenseForm();

}

/* =========================================================
   MEMBER SUMMARY
========================================================= */

function renderMemberSummary() {

    const container =
        document.getElementById(
            "memberSummary"
        );


    container.innerHTML =
        "";


    /*
        Cash / E-wallet debts.

        This uses the existing debt system.
    */

    const debts =
        calculateDebts();


    members.forEach(
        member => {

            let totalShare = 0;


            /*
                Calculate the member's total
                share across ALL expenses.
            */

            expenses.forEach(
                expense => {

                    totalShare +=
                        Number(
                            expense.splits?.[
                                member.id
                            ] || 0
                        );

                }
            );


            /*
                =================================================
                CASH / E-WALLET OUTSTANDING DEBT
                =================================================

                Check each individual debt so that
                paid/unpaid status is tracked per expense.
            */

            let cashDebt = 0;


            debts.forEach(
                debt => {

                    if (
                        debt.debtorId !==
                        member.id
                    ) {

                        return;

                    }


                    if (
                        isDebtPaid(
                            debt.expenseId,
                            debt.debtorId,
                            debt.creditorId
                        )
                    ) {

                        return;

                    }


                    cashDebt +=
                        Number(
                            debt.amount || 0
                        );

                }
            );


            /*
                =================================================
                CREDIT-CARD OUTSTANDING BALANCE
                =================================================
            */

            let creditCardRemaining = 0;


            getBillGroups()
                .forEach(
                    bill => {

                        creditCardRemaining +=
                            getMemberRemainingBalance(
                                bill,
                                member.id
                            );

                    }
                );


            /*
                Round financial values.
            */

            cashDebt =
                Number(
                    cashDebt.toFixed(2)
                );


            creditCardRemaining =
                Number(
                    creditCardRemaining.toFixed(2)
                );


            /*
                =================================================
                AMOUNT STILL OWED
                =================================================
            */

            const totalOwed =
                Number(
                    (
                        cashDebt +
                        creditCardRemaining
                    ).toFixed(2)
                );


            /*
                =================================================
                AMOUNT STILL OWED TO THIS MEMBER
                =================================================

                Check each individual debt where
                this member is the creditor.
            */

            let cashReceivable = 0;


            debts.forEach(
                debt => {

                    if (
                        debt.creditorId !==
                        member.id
                    ) {

                        return;

                    }


                    if (
                        isDebtPaid(
                            debt.expenseId,
                            debt.debtorId,
                            debt.creditorId
                        )
                    ) {

                        return;

                    }


                    cashReceivable +=
                        Number(
                            debt.amount || 0
                        );

                }
            );


            cashReceivable =
                Number(
                    cashReceivable.toFixed(2)
                );


            /*
                =================================================
                NET POSITION
                =================================================
            */

            const net =
                Number(
                    (
                        cashReceivable -
                        totalOwed
                    ).toFixed(2)
                );


            /*
                =================================================
                NET POSITION DISPLAY
                =================================================
            */

            let netHTML = "";


            if (
                net >
                0.009
            ) {

                netHTML = `

                    <strong class="green">

                        Gets back
                        ${money(net)}

                    </strong>

                `;

            }
            else if (
                net <
                -0.009
            ) {

                netHTML = `

                    <strong class="red">

                        Owes
                        ${money(
                            Math.abs(net)
                        )}

                    </strong>

                `;

            }
            else {

                netHTML = `

                    <strong class="green">

                        ✓ Fully Settled

                    </strong>

                `;

            }


            /*
                =================================================
                MEMBER CARD
                =================================================
            */

            const div =
                document.createElement(
                    "div"
                );


            div.className =
                "member-card";


            div.innerHTML = `

                <div class="member-name">

                    <span class="member-avatar">

                        ${escapeHTML(
                            member.name
                                .split(" ")
                                .map(
                                    name =>
                                        name.charAt(0)
                                )
                                .join("")
                                .substring(0, 2)
                                .toUpperCase()
                        )}

                    </span>

                    <span class="member-name-text">

                        ${escapeHTML(
                            member.name
                        )}

                    </span>

                </div>


                <div class="member-line">

                    <span class="muted">
                        Their share
                    </span>

                    <strong>
                        ${money(
                            totalShare
                        )}
                    </strong>

                </div>


                <div class="member-line">

                    <span class="muted">
                        Credit-card remaining
                    </span>

                    <strong
                        class="${
                            creditCardRemaining >
                            0.009
                                ? "red"
                                : "green"
                        }"
                    >

                        ${money(
                            creditCardRemaining
                        )}

                    </strong>

                </div>


                <div class="member-line">

                    <span class="muted">
                        Cash/E-wallet owed
                    </span>

                    <strong
                        class="${
                            cashDebt >
                            0.009
                                ? "red"
                                : "green"
                        }"
                    >

                        ${money(
                            cashDebt
                        )}

                    </strong>

                </div>


                ${
                    cashReceivable >
                    0.009
                        ? `

                            <div class="member-line">

                                <span class="muted">
                                    Still owed to them
                                </span>

                                <strong class="green">

                                    ${money(
                                        cashReceivable
                                    )}

                                </strong>

                            </div>

                        `
                        : ""
                }


                <div class="member-line">

                    <span class="muted">
                        Net position
                    </span>

                    ${netHTML}

                </div>

            `;


            container.appendChild(
                div
            );

        }
    );

}

/* =========================================================
   CREDIT CARD BILLING
========================================================= */

function getBillingPeriod(
    expense,
    card
) {

    const date =
        new Date(
            expense.date +
            "T00:00:00"
        );


    const statementDay =
        Number(
            card.statementDay || 1
        );


    let statementYear =
        date.getFullYear();


    let statementMonth =
        date.getMonth();


    if (
        date.getDate() >
        statementDay
    ) {

        statementMonth++;

    }


    const normalized =
        new Date(
            statementYear,
            statementMonth,
            1
        );


    statementYear =
        normalized.getFullYear();


    statementMonth =
        normalized.getMonth();


    const start =
        new Date(
            statementYear,
            statementMonth - 1,
            statementDay + 1
        );


    const end =
        new Date(
            statementYear,
            statementMonth,
            statementDay
        );


    const dueDate =
        new Date(
            statementYear,
            statementMonth,
            Number(
                card.dueDay || 30
            )
        );


    return {

        year:
            statementYear,

        month:
            statementMonth,

        start,

        end,

        dueDate

    };

}


function getBillKey(
    card,
    period
) {

    return [

        card.id,

        period.year,

        period.month

    ].join("_");

}


function getCardForExpense(
    expense
) {

    if (
        !expense.creditCardId
    ) {

        return null;

    }


    return creditCards.find(
        card =>
            String(
                card.id
            ) ===
            String(
                expense.creditCardId
            )
    );

}


function getBillGroups() {

    const groups = {};


    expenses.forEach(
        expense => {

            const isCreditCard =
                expense.paymentMethod ===
                "credit_card";


            if (!isCreditCard)
                return;


            const card =
                getCardForExpense(
                    expense
                );


            if (!card)
                return;


            const period =
                getBillingPeriod(
                    expense,
                    card
                );


            const key =
                getBillKey(
                    card,
                    period
                );


            if (!groups[key]) {

                groups[key] = {

                    key,

                    card,

                    period,

                    expenses: []

                };

            }


            groups[key]
                .expenses
                .push(
                    expense
                );

        }
    );


    return Object.values(
        groups
    );

}


function getMemberBillAmount(
    bill,
    memberId
) {

    return bill.expenses.reduce(
        (
            total,
            expense
        ) =>
            total +
            Number(
                expense.splits?.[
                    memberId
                ] || 0
            ),
        0
    );

}


/* =========================================================
   PARTIAL CARD PAYMENTS
========================================================= */

function getMemberPaymentAmount(
    bill,
    memberId
) {

    const value =
        billPayments[
            bill.key
        ]?.[
            memberId
        ];


    /*
        New system:

        number =
        exact amount paid.
    */

    if (
        typeof value ===
        "number"
    ) {

        return Math.max(
            0,
            value
        );

    }


    /*
        Old system:

        true = full payment.
    */

    if (
        value === true
    ) {

        return getMemberBillAmount(
            bill,
            memberId
        );

    }


    return 0;

}


function getMemberRemainingBalance(
    bill,
    memberId
) {

    const total =
        getMemberBillAmount(
            bill,
            memberId
        );


    const paid =
        getMemberPaymentAmount(
            bill,
            memberId
        );


    return Math.max(
        0,
        Number(
            (
                total -
                paid
            ).toFixed(2)
        )
    );

}
async function recordCardPayment(
    billKey,
    memberId
) {

    if (!currentUser) {

        alert(
            "You are not logged in."
        );

        return;

    }


    if (!currentGroupId) {

        alert(
            "No group is currently selected."
        );

        return;

    }


    const bill =
        findBill(
            billKey
        );


    if (!bill)
        return;


    const total =
        getMemberBillAmount(
            bill,
            memberId
        );


    const current =
        getMemberPaymentAmount(
            bill,
            memberId
        );


    const remaining =
        Math.max(
            0,
            total -
            current
        );


    if (
        remaining <= 0
    ) {

        alert(
            "This member's statement is already fully paid."
        );

        return;

    }

const input =
    document.getElementById(
        "payment-" +
        billKey +
        "-" +
        memberId
    );

    if (!input) {

        console.error(
            "Payment input was not found."
        );

        return;

    }


    const amount =
        Number(
            input.value
        );


    if (
        !Number.isFinite(amount) ||
        amount <= 0
    ) {

        alert(
            "Enter a valid payment amount."
        );

        return;

    }


    if (
        amount >
        remaining + 0.01
    ) {

        alert(
            "Payment cannot exceed the remaining balance.\n\n" +
            "Remaining: " +
            money(remaining)
        );

        return;

    }


    /*
        Calculate the new total payment.
    */

    const newPayment =
        Number(
            (
                current +
                amount
            ).toFixed(2)
        );


    /*
        Save the partial payment
        directly to Supabase.
    */

    const {
        error
    } = await supabaseClient
        .from("bill_payments")
        .upsert(
            {

                group_id:
                    currentGroupId,

                credit_card_id:
                    bill.card.id,

                member_id:
                    memberId,

                billing_year:
                    bill.period.year,

                billing_month:
                    bill.period.month,

                amount:
                    newPayment

            },
            {
                onConflict:
                    "credit_card_id,member_id,billing_year,billing_month"
            }
        );


    if (error) {

        console.error(
            "Could not save partial card payment:",
            error
        );


        alert(
            "Could not save the payment.\n\n" +
            error.message
        );

        return;

    }


    /*
        Update local state immediately.
    */

    if (
        !billPayments[
            billKey
        ]
    ) {

        billPayments[
            billKey
        ] = {};

    }


    billPayments[
        billKey
    ][
        memberId
    ] =
        newPayment;


    /*
        Clear the input.
    */

    input.value = "";


    /*
        Refresh the interface.
    */

    renderAll();


    console.log(
        "Partial credit card payment recorded:",
        {
            billKey,
            memberId,
            amount,
            totalPaid:
                newPayment
        }
    );

}


async function markCardFullyPaid(
    billKey,
    memberId
) {

    if (!currentUser) {

        alert(
            "You are not logged in."
        );

        return;

    }


    if (!currentGroupId) {

        alert(
            "No group is currently selected."
        );

        return;

    }


    const bill =
        findBill(
            billKey
        );


    if (!bill)
        return;


    const total =
        getMemberBillAmount(
            bill,
            memberId
        );


    if (total <= 0) {

        alert(
            "This member has no balance to pay."
        );

        return;

    }


    /*
        Save the full payment
        to Supabase.
    */

    const {
        error
    } = await supabaseClient
        .from("bill_payments")
        .upsert(
            {
                group_id:
                    currentGroupId,

                credit_card_id:
                    bill.card.id,

                member_id:
                    memberId,

                billing_year:
                    bill.period.year,

                billing_month:
                    bill.period.month,

                amount:
                    Number(
                        total.toFixed(2)
                    )

            },
            {
                onConflict:
                    "credit_card_id,member_id,billing_year,billing_month"
            }
        );


    if (error) {

        console.error(
            "Could not mark card payment as fully paid:",
            error
        );


        alert(
            "Could not save the payment.\n\n" +
            error.message
        );


        return;

    }


    /*
        Update local state so
        the UI changes immediately.
    */

    if (
        !billPayments[
            billKey
        ]
    ) {

        billPayments[
            billKey
        ] = {};

    }


    billPayments[
        billKey
    ][
        memberId
    ] =
        Number(
            total.toFixed(2)
        );


    renderAll();


    console.log(
        "Credit card marked fully paid:",
        {
            billKey,
            memberId,
            amount:
                total
        }
    );

}
async function markCardPaymentPending(
    billKey,
    memberId
) {

    if (!currentUser) {

        alert(
            "You are not logged in."
        );

        return;

    }


    if (!currentGroupId) {

        alert(
            "No group is currently selected."
        );

        return;

    }


    const bill =
        findBill(
            billKey
        );


    if (!bill)
        return;


    const {
        error
    } = await supabaseClient
        .from("bill_payments")
        .delete()
        .eq(
            "group_id",
            currentGroupId
        )
        .eq(
            "credit_card_id",
            bill.card.id
        )
        .eq(
            "member_id",
            memberId
        )
        .eq(
            "billing_year",
            bill.period.year
        )
        .eq(
            "billing_month",
            bill.period.month
        );


    if (error) {

        console.error(
            "Could not reset card payment:",
            error
        );


        alert(
            "Could not reset the payment.\n\n" +
            error.message
        );


        return;

    }


    /*
        Remove from local state.
    */

    if (
        billPayments[
            billKey
        ]
    ) {

        delete billPayments[
            billKey
        ][
            memberId
        ];

    }


    renderAll();


    console.log(
        "Credit card payment reset:",
        {
            billKey,
            memberId
        }
    );

}

/* =========================================================
   PENDING CARD PAYMENTS
========================================================= */

function calculatePendingPayments() {

    let total = 0;


    getBillGroups()
        .forEach(
            bill => {

                members.forEach(
                    member => {

                        total +=
                            getMemberRemainingBalance(
                                bill,
                                member.id
                            );

                    }
                );

            }
        );


    return total;

}

/* =========================================================
   RENDER BILLS
========================================================= */

function renderBills() {

    const container =
        document.getElementById(
            "creditCardBills"
        );


    container.innerHTML = "";


    const bills =
        getBillGroups();


    if (
        bills.length === 0
    ) {

        container.innerHTML = `

            <div class="empty">
                No credit-card statements yet.
            </div>

        `;

        return;

    }


    /*
        Sort oldest -> newest by due date.
    */

    bills.sort(
        (
            a,
            b
        ) =>
            a.period.dueDate -
            b.period.dueDate
    );


    /*
        Separate active and fully-paid
        statements.
    */

    const activeBills = [];

    const paidBills = [];


    bills.forEach(
        bill => {

            const fullyPaid =
                members.every(
                    member => {

                        const amount =
                            getMemberBillAmount(
                                bill,
                                member.id
                            );


                        /*
                            Members with no share
                            don't need to be paid.
                        */

                        if (
                            amount <= 0
                        ) {

                            return true;

                        }


                        return (
                            getMemberRemainingBalance(
                                bill,
                                member.id
                            ) <= 0.009
                        );

                    }
                );


            if (
                fullyPaid
            ) {

                paidBills.push(
                    bill
                );

            }
            else {

                activeBills.push(
                    bill
                );

            }

        }
    );

/* =====================================================
   ACTIVE STATEMENTS
===================================================== */

const activeSection =
    document.createElement("div");

activeSection.className = "statement-list";

activeSection.dataset.statementTab = "active";


activeSection.innerHTML = `

    <div class="statement-list-header">

        <h3>
            Active Statements
        </h3>

        <span class="expense-meta">

            ${activeBills.length}
            statement${
                activeBills.length === 1
                    ? ""
                    : "s"
            }

        </span>

    </div>

`;


const activeContainer =
    document.createElement("div");


activeSection.appendChild(
    activeContainer
);


if (
    activeBills.length === 0
) {

    activeContainer.innerHTML = `

        <div class="empty">

            ✓ No active credit-card
            statements.

        </div>

    `;

}
else {

    activeBills.forEach(
        bill => {

            activeContainer.appendChild(
                createBillCard(
                    bill,
                    false
                )
            );

        }
    );

}


/* =====================================================
   PAID HISTORY
===================================================== */

const historySection =
    document.createElement("div");

historySection.className = "statement-list";

historySection.dataset.statementTab = "paid";

historySection.style.display = "none";


historySection.innerHTML = `

    <div class="statement-list-header">

        <h3>
            Paid History
        </h3>

        <span class="expense-meta">

            ${paidBills.length}
            statement${
                paidBills.length === 1
                    ? ""
                    : "s"
            }

        </span>

    </div>

`;


const historyContainer =
    document.createElement("div");


historySection.appendChild(
    historyContainer
);


if (
    paidBills.length === 0
) {

    historyContainer.innerHTML = `

        <div class="empty">

            No fully paid statements yet.

        </div>

    `;

}
else {

    /*
        Newest paid statements first.
    */

    paidBills
        .slice()
        .reverse()
        .forEach(
            bill => {

                historyContainer.appendChild(
                    createBillCard(
                        bill,
                        true
                    )
                );

            }
        );

}


/* =====================================================
   ADD BOTH TAB CONTENTS
===================================================== */

container.appendChild(
    activeSection
);

container.appendChild(
    historySection
);

}

/* =========================================================
   CREDIT CARD STATEMENT TABS
========================================================= */

function switchStatementTab(tab) {

    const activeTab =
        document.getElementById(
            "activeStatementsTab"
        );

    const paidTab =
        document.getElementById(
            "paidHistoryTab"
        );


    const activeSection =
        document.querySelector(
            '[data-statement-tab="active"]'
        );

    const paidSection =
        document.querySelector(
            '[data-statement-tab="paid"]'
        );


    if (
        !activeTab ||
        !paidTab ||
        !activeSection ||
        !paidSection
    ) {

        return;

    }


    if (
        tab === "active"
    ) {

        /* Buttons */

        activeTab.classList.add(
            "active"
        );

        paidTab.classList.remove(
            "active"
        );


        /* Content */

        activeSection.style.display =
            "block";

        paidSection.style.display =
            "none";

    }


    else if (
        tab === "paid"
    ) {

        /* Buttons */

        paidTab.classList.add(
            "active"
        );

        activeTab.classList.remove(
            "active"
        );


        /* Content */

        activeSection.style.display =
            "none";

        paidSection.style.display =
            "block";

    }

}

/* =========================================================
   CREATE CREDIT CARD STATEMENT CARD
========================================================= */

function createBillCard(
    bill,
    isPaidHistory
) {

    const total =
        bill.expenses.reduce(
            (
                sum,
                expense
            ) =>
                sum +
                Number(
                    expense.amount ||
                    0
                ),
            0
        );


    const totalPaid =
        members.reduce(
            (
                sum,
                member
            ) =>
                sum +
                getMemberPaymentAmount(
                    bill,
                    member.id
                ),
            0
        );


    const remaining =
        Math.max(
            0,
            total -
            totalPaid
        );


    const dueDate =
        bill.period.dueDate
            .toLocaleDateString(
                "en-PH",
                {
                    year:
                        "numeric",

                    month:
                        "long",

                    day:
                        "numeric"
                }
            );


    const startDate =
        bill.period.start
            .toLocaleDateString(
                "en-PH",
                {
                    month:
                        "short",

                    day:
                        "numeric",

                    year:
                        "numeric"
                }
            );


    const endDate =
        bill.period.end
            .toLocaleDateString(
                "en-PH",
                {
                    month:
                        "short",

                    day:
                        "numeric",

                    year:
                        "numeric"
                }
            );


    const card =
        document.createElement(
            "div"
        );


    card.className =
        "bill-card";


    /*
        -----------------------------------------------------
        PAID HISTORY
        -----------------------------------------------------

        Only show the compact statement information
        initially.
    */

    if (
        isPaidHistory
    ) {

        const historyId =
            "paid-history-" +
            bill.key
                .replace(
                    /[^a-zA-Z0-9_-]/g,
                    "_"
                );


        card.innerHTML = `

            <div class="bill-header">

                <div>

                    <div class="bill-title">

                        💳
                        ${escapeHTML(
                            bill.card.name
                        )}

                    </div>


                    <div class="bill-info">

                        Owner:
                        ${escapeHTML(
                            getMemberName(
                                bill.card.ownerId
                            )
                        )}

                        <br>

                        Statement:
                        ${startDate}
                        –
                        ${endDate}

                        <br>

                        Due:
                        <strong>
                            ${dueDate}
                        </strong>

                    </div>

                </div>


                <div>

                    <div class="bill-total">

                        ${money(total)}

                    </div>

                    <div class="bill-info green">

                        ✓ Fully Paid

                    </div>

                </div>

            </div>


            <div
                style="
                    margin-top:15px;
                    text-align:right;
                "
            >

                <button
                    class="secondary small-btn"
                    onclick="togglePaidHistoryMembers(
                        '${escapeHTML(
                            historyId
                        )}',
                        this
                    )"
                >
                    👥 View Members ▼
                </button>

            </div>


            <div
                id="${escapeHTML(
                    historyId
                )}"
                style="
                    display:none;
                    margin-top:20px;
                "
            >

                ${buildPaidHistoryMembersHTML(
                    bill
                )}

            </div>

        `;

        return card;

    }


    /*
        -----------------------------------------------------
        ACTIVE STATEMENT
        -----------------------------------------------------
    */

    let membersHTML =
        "";


    members.forEach(
        member => {

            const amount =
                getMemberBillAmount(
                    bill,
                    member.id
                );


            if (
                amount <= 0
            )
                return;


            const paid =
                getMemberPaymentAmount(
                    bill,
                    member.id
                );


            const memberRemaining =
                getMemberRemainingBalance(
                    bill,
                    member.id
                );


            const fullyPaid =
                memberRemaining <=
                0.009;


            membersHTML += `

                <div class="bill-member">

                    <div class="bill-member-top">

                        <div>

                            <div class="bill-member-name">

                                👤
                                ${escapeHTML(
                                    member.name
                                )}

                            </div>


                            <div class="bill-info">

                                Statement share:
                                ${money(amount)}

                                <br>

                                Paid:
                                ${money(paid)}

                                <br>

                                ${
                                    fullyPaid
                                        ? "✓ Fully paid"
                                        : "⏳ Remaining " +
                                          money(
                                              memberRemaining
                                          )
                                }

                            </div>

                        </div>


                        <div class="bill-member-amount">

                            ${money(
                                memberRemaining
                            )}

                        </div>

                    </div>


                    ${
                        !fullyPaid
                            ? `

                            <div class="payment-box">

                                <strong>
                                    Record Payment
                                </strong>

                                <br><br>

                                <input
                                    id="payment-${escapeHTML(
                                        bill.key +
                                        "-" +
                                        member.id
                                    )}"
                                    type="number"
                                    min="0.01"
                                    max="${memberRemaining}"
                                    step="0.01"
                                    placeholder="Amount"
                                >


                                <button
                                    class="success small-btn"
                                    onclick="recordCardPayment(
                                        '${escapeHTML(
                                            bill.key
                                        )}',
                                        '${escapeHTML(
                                            member.id
                                        )}'
                                    )"
                                >
                                    Record
                                </button>


                                <button
                                    class="primary small-btn"
                                    onclick="markCardFullyPaid(
                                        '${escapeHTML(
                                            bill.key
                                        )}',
                                        '${escapeHTML(
                                            member.id
                                        )}'
                                    )"
                                >
                                    Pay Remaining
                                </button>

                            </div>

                        `
                            : ""
                    }


                    <div class="bill-actions">

                        ${
                            fullyPaid
                                ? `

                                    <button
                                        class="secondary small-btn"
                                        onclick="markCardPaymentPending(
                                            '${escapeHTML(
                                                bill.key
                                            )}',
                                            '${escapeHTML(
                                                member.id
                                            )}'
                                        )"
                                    >
                                        ↩ Reset Payment
                                    </button>

                                `
                                : ""
                        }


                        <button
                            class="secondary small-btn"
                            onclick="printMemberReceipt(
                                '${escapeHTML(
                                    bill.key
                                )}',
                                '${escapeHTML(
                                    member.id
                                )}'
                            )"
                        >
                            🖨️ Print Statement
                        </button>


                        <button
                            class="primary small-btn"
                            onclick="downloadMemberReceipt(
                                '${escapeHTML(
                                    bill.key
                                )}',
                                '${escapeHTML(
                                    member.id
                                )}'
                            )"
                        >
                            📥 Download
                        </button>

                    </div>

                </div>

            `;

        }
    );


    card.innerHTML = `

        <div class="bill-header">

            <div>

                <div class="bill-title">

                    💳
                    ${escapeHTML(
                        bill.card.name
                    )}

                </div>


                <div class="bill-info">

                    Owner:
                    ${escapeHTML(
                        getMemberName(
                            bill.card.ownerId
                        )
                    )}

                    <br>

                    Statement:
                    ${startDate}
                    –
                    ${endDate}

                    <br>

                    Due:
                    <strong>
                        ${dueDate}
                    </strong>

                </div>

            </div>


            <div>

                <div class="bill-total">

                    ${money(total)}

                </div>

                <div class="bill-info">

                    Paid:
                    ${money(totalPaid)}

                    <br>

                    Remaining:
                    <strong class="${
                        remaining > 0
                            ? "red"
                            : "green"
                    }">

                        ${money(remaining)}

                    </strong>

                </div>

            </div>

        </div>


        ${membersHTML}

    `;


    return card;

}


/* =========================================================
   PAID HISTORY MEMBER DETAILS
========================================================= */

function buildPaidHistoryMembersHTML(
    bill
) {

    let html =
        `

        <div
            style="
                border-top:1px solid #e5e7eb;
                padding-top:15px;
            "
        >

            <strong>
                Members
            </strong>

    `;


    members.forEach(
        member => {

            const amount =
                getMemberBillAmount(
                    bill,
                    member.id
                );


            /*
                Don't show members who had
                no share on this statement.
            */

            if (
                amount <= 0
            )
                return;


            const paid =
                getMemberPaymentAmount(
                    bill,
                    member.id
                );


            html += `

                <div
                    class="bill-member"
                    style="
                        margin-top:10px;
                    "
                >

                    <div class="bill-member-top">

                        <div>

                            <div class="bill-member-name">

                                👤
                                ${escapeHTML(
                                    member.name
                                )}

                            </div>

                            <div class="bill-info">

                                Statement share:
                                ${money(amount)}

                                <br>

                                Paid:
                                ${money(paid)}

                            </div>

                        </div>


                        <div>

                            <span class="green">

                                ✓ Paid

                            </span>

                        </div>

                    </div>

                </div>

            `;

        }
    );


    html += `
        </div>
    `;


    return html;

}


/* =========================================================
   TOGGLE PAID HISTORY MEMBERS
========================================================= */

function togglePaidHistoryMembers(
    historyId,
    button
) {

    const container =
        document.getElementById(
            historyId
        );


    if (!container)
        return;


    const hidden =
        container.style.display ===
        "none";


    container.style.display =
        hidden
            ? "block"
            : "none";


    button.textContent =
        hidden
            ? "👥 Hide Members ▲"
            : "👥 View Members ▼";

}
/* =========================================================
   RECEIPTS
========================================================= */

function findBill(
    billKey
) {

    return getBillGroups()
        .find(
            bill =>
                bill.key ===
                billKey
        );

}


function buildReceiptHTML(
    bill,
    memberId
) {

    const member =
        getMember(
            memberId
        );


    if (!member)
        return "";


    const amount =
        getMemberBillAmount(
            bill,
            memberId
        );


    const paid =
        getMemberPaymentAmount(
            bill,
            memberId
        );


    const remaining =
        getMemberRemainingBalance(
            bill,
            memberId
        );


    const dueDate =
        bill.period.dueDate
            .toLocaleDateString(
                "en-PH",
                {
                    year:
                        "numeric",

                    month:
                        "long",

                    day:
                        "numeric"
                }
            );


    const startDate =
        bill.period.start
            .toLocaleDateString(
                "en-PH",
                {
                    year:
                        "numeric",

                    month:
                        "long",

                    day:
                        "numeric"
                }
            );


    const endDate =
        bill.period.end
            .toLocaleDateString(
                "en-PH",
                {
                    year:
                        "numeric",

                    month:
                        "long",

                    day:
                        "numeric"
                }
            );


    let rows = "";


    bill.expenses.forEach(
        expense => {

            const share =
                Number(
                    expense.splits?.[
                        memberId
                    ] || 0
                );


            if (
                share <= 0
            )
                return;


            rows += `

                <div class="receipt-line">

                    <div>

                        <strong>
                            ${escapeHTML(
                                expense.description
                            )}
                        </strong>

                        <br>

                        <small>

                            ${formatDate(
                                expense.date
                            )}

                            •

                            ${escapeHTML(
                                expense.category
                            )}

                        </small>

                    </div>


                    <div>

                        ${money(share)}

                    </div>

                </div>

            `;

        }
    );


    return `

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<title>
    Statement -
    ${escapeHTML(member.name)}
</title>

<style>

* {
    box-sizing: border-box;
}

body {
    font-family:
        Arial,
        Helvetica,
        sans-serif;

    background:
        #f1f5f9;

    padding:
        30px;

    color:
        #111827;
}

.receipt {
    max-width:
        700px;

    margin:
        auto;

    background:
        white;

    padding:
        35px;

    border-radius:
        14px;
}

h1 {
    text-align:
        center;
}

.subtitle {
    text-align:
        center;

    color:
        #64748b;
}

.info {
    background:
        #f1f5f9;

    padding:
        18px;

    border-radius:
        10px;

    margin:
        25px 0;

    line-height:
        1.7;
}

.receipt-line {
    display:
        flex;

    justify-content:
        space-between;

    gap:
        20px;

    padding:
        13px 0;

    border-bottom:
        1px solid
        #e5e7eb;
}

.receipt-line small {
    color:
        #64748b;
}

.total {
    display:
        flex;

    justify-content:
        space-between;

    font-size:
        22px;

    font-weight:
        bold;

    padding-top:
        22px;
}

.status {
    margin-top:
        20px;

    padding:
        13px;

    border-radius:
        9px;

    text-align:
        center;

    font-weight:
        bold;

    background:
        ${
            remaining <= 0.009
                ? "#dcfce7"
                : "#fef3c7"
        };

    color:
        ${
            remaining <= 0.009
                ? "#166534"
                : "#92400e"
        };
}

.footer {
    text-align:
        center;

    margin-top:
        30px;

    color:
        #6b7280;

    font-size:
        12px;
}

@media print {

    body {
        background:
            white;

        padding:
            0;
    }

}

</style>

</head>

<body>

<div class="receipt">

    <h1>
        GROUP EXPENSE STATEMENT
    </h1>

    <div class="subtitle">
        Credit Card Statement
    </div>

    <div
        style="
            text-align:center;
            margin-top:15px;
        "
    >

        <strong>
            ${escapeHTML(
                bill.card.name
            )}
        </strong>

    </div>


    <div class="info">

        <strong>
            Member:
        </strong>

        ${escapeHTML(
            member.name
        )}

        <br>

        <strong>
            Card Owner:
        </strong>

        ${escapeHTML(
            getMemberName(
                bill.card.ownerId
            )
        )}

        <br>

        <strong>
            Statement Period:
        </strong>

        ${startDate}
        –
        ${endDate}

        <br>

        <strong>
            Due Date:
        </strong>

        ${dueDate}

    </div>


    <h3>
        Your Expenses
    </h3>


    ${rows}


    <div class="total">

        <span>
            STATEMENT SHARE
        </span>

        <span>
            ${money(amount)}
        </span>

    </div>


    <div class="total">

        <span>
            PAID
        </span>

        <span>
            ${money(paid)}
        </span>

    </div>


    <div class="total">

        <span>
            REMAINING
        </span>

        <span>
            ${money(remaining)}
        </span>

    </div>


    <div class="status">

        ${
            remaining <= 0.009
                ? "✓ PAYMENT COMPLETED"
                : "⏳ PAYMENT PENDING"
        }

    </div>


    <div class="footer">

        Generated by Group Expense Tracker

    </div>

</div>

</body>

</html>

`;

}


/* =========================================================
   PRINT
========================================================= */

function printMemberReceipt(
    billKey,
    memberId
) {

    const bill =
        findBill(
            billKey
        );


    if (!bill)
        return;


    const html =
        buildReceiptHTML(
            bill,
            memberId
        );


    const win =
        window.open(
            "",
            "_blank"
        );


    if (!win) {

        alert(
            "Please allow pop-ups to print the statement."
        );

        return;

    }


    win.document.open();

    win.document.write(
        html
    );

    win.document.close();


    setTimeout(
        () => {

            win.focus();

            win.print();

        },
        400
    );

}


/* =========================================================
   DOWNLOAD
========================================================= */

function downloadMemberReceipt(
    billKey,
    memberId
) {

    const bill =
        findBill(
            billKey
        );


    if (!bill)
        return;


    const member =
        getMember(
            memberId
        );


    if (!member)
        return;


    const html =
        buildReceiptHTML(
            bill,
            memberId
        );


    const blob =
        new Blob(
            [html],
            {
                type:
                    "text/html"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const a =
        document.createElement(
            "a"
        );


    a.href =
        url;


    a.download =
        `${bill.card.name}-${member.name}-statement.html`
            .replace(
                /\s+/g,
                "-"
            );


    document.body.appendChild(
        a
    );


    a.click();


    a.remove();


    URL.revokeObjectURL(
        url
    );

}


/* =========================================================
   DEBTS
========================================================= */

function calculateDebts() {

    const debts = [];


    expenses.forEach(
        expense => {

            /*
                Credit-card expenses are handled
                separately by the statement system.
            */

            if (
                expense.paymentMethod ===
                "credit_card"
            ) {

                return;

            }


            const payerId =
                expense.paidById;


            /*
                Make sure the payer still exists.
            */

            if (
                !members.some(
                    member =>
                        member.id === payerId
                )
            ) {

                return;

            }


            /*
                Each person's split becomes
                an individual debt for this
                specific expense.
            */

            members.forEach(
                person => {

                    if (
                        person.id ===
                        payerId
                    ) {

                        return;

                    }


                    const share =
                        Number(
                            expense.splits?.[
                                person.id
                            ] || 0
                        );


                    if (
                        share <= 0
                    ) {

                        return;

                    }


                    debts.push({

                        expenseId:
                            expense.id,

                        description:
                            expense.description,

                        date:
                            expense.date,

                        debtorId:
                            person.id,

                        creditorId:
                            payerId,

                        amount:
                            share

                    });

                }
            );

        }
    );


    return debts;

}

/* =========================================================
   DEBT PAYMENT KEY
   STEP 12.5
========================================================= */

function getDebtKey(
    expenseId,
    debtorId,
    creditorId
) {

    return (
        expenseId +
        "___" +
        debtorId +
        "___" +
        creditorId
    );

}


/* =========================================================
   CHECK IF SPECIFIC EXPENSE DEBT IS PAID
========================================================= */

function isDebtPaid(
    expenseId,
    debtorId,
    creditorId
) {

    const key =
        getDebtKey(
            expenseId,
            debtorId,
            creditorId
        );


    return Boolean(
        debtPayments[key]
    );

}
/* =========================================================
   TOGGLE DEBT PAYMENT
   STEP 12.6
========================================================= */

async function toggleDebtPaid(
    expenseId,
    debtorId,
    creditorId
) {

    if (!currentUser) {

        alert(
            "You are not logged in."
        );

        return;

    }


    if (!currentGroupId) {

        alert(
            "No group is currently selected."
        );

        return;

    }


    const expense =
        expenses.find(
            e =>
                e.id === expenseId
        );


    if (!expense) {

        alert(
            "The expense could not be found."
        );

        return;

    }


    const amount =
        Number(
            expense.splits?.[
                debtorId
            ] || 0
        );


    if (amount <= 0) {

        alert(
            "No debt amount was found."
        );

        return;

    }


    const key =
        getDebtKey(
            expenseId,
            debtorId,
            creditorId
        );


    const currentlyPaid =
        isDebtPaid(
            expenseId,
            debtorId,
            creditorId
        );


    /* =====================================================
       MARK UNPAID
    ===================================================== */

    if (currentlyPaid) {

        const {
            error
        } = await supabaseClient
            .from("debt_payments")
            .delete()
            .eq(
                "group_id",
                currentGroupId
            )
            .eq(
                "expense_id",
                expenseId
            )
            .eq(
                "debtor_id",
                debtorId
            )
            .eq(
                "creditor_id",
                creditorId
            );


        if (error) {

            console.error(
                "Could not mark debt as unpaid:",
                error
            );


            alert(
                "Could not reset the debt payment.\n\n" +
                error.message
            );

            return;

        }


        delete debtPayments[key];


        renderAll();

        return;

    }


    /* =====================================================
       MARK PAID
    ===================================================== */

    const {
        error
    } = await supabaseClient
        .from("debt_payments")
        .upsert(
            {

                group_id:
                    currentGroupId,

                expense_id:
                    expenseId,

                debtor_id:
                    debtorId,

                creditor_id:
                    creditorId,

                amount:
                    amount,

                paid:
                    true

            },
            {
                onConflict:
                    "expense_id,debtor_id,creditor_id"
            }
        );


    if (error) {

        console.error(
            "Could not save debt payment:",
            error
        );


        alert(
            "Could not save debt payment.\n\n" +
            error.message
        );

        return;

    }


    debtPayments[key] =
        true;


    renderAll();


    console.log(
        "Debt payment saved:",
        {
            expenseId,
            debtorId,
            creditorId,
            amount
        }
    );

}

/* =========================================================
   RENDER DEBTS
   STEP 12.7 → EXPENSE-BASED DEBTS
========================================================= */

function renderDebts() {

    const container =
        document.getElementById(
            "debtsContainer"
        );


    const paidContainer =
        document.getElementById(
            "paidDebtsContainer"
        );


    if (!container || !paidContainer)
        return;


    container.innerHTML = "";

    paidContainer.innerHTML = "";

    /*
        Active tab should be shown
        whenever the debts section
        is rendered.
    */

    container.style.display =
        "block";

    paidContainer.style.display =
        "none";


    const activeTab =
        document.getElementById(
            "activeDebtsTab"
        );


    const paidTab =
        document.getElementById(
            "paidDebtsTab"
        );


    if (activeTab) {

        activeTab.classList.add(
            "active"
        );

    }


    if (paidTab) {

        paidTab.classList.remove(
            "active"
        );

    }


    const debts =
        calculateDebts();


    const outstandingDebts = [];
    const paidDebts = [];


    /*
        Separate paid and unpaid debts.
    */

    debts.forEach(
        debt => {

            const paid =
                isDebtPaid(
                    debt.expenseId,
                    debt.debtorId,
                    debt.creditorId
                );


            if (paid) {

                paidDebts.push(
                    debt
                );

            }
            else {

                outstandingDebts.push(
                    debt
                );

            }

        }
    );


    /* =====================================================
       OUTSTANDING DEBTS
    ===================================================== */

    if (
        outstandingDebts.length === 0
    ) {

        container.innerHTML = `

            <div class="empty">

                No outstanding cash or
                e-wallet debts.

            </div>

        `;

    }
    else {

        outstandingDebts.forEach(
            debt => {

                const debtor =
                    getMember(
                        debt.debtorId
                    );


                const creditor =
                    getMember(
                        debt.creditorId
                    );


                if (
                    !debtor ||
                    !creditor
                ) {

                    return;

                }


                const div =
                    document.createElement(
                        "div"
                    );


                div.className =
                    "debt-card";


                div.innerHTML = `

                    <div class="debt-row">

                        <div>

                            <strong>

                                ${escapeHTML(
                                    debtor.name
                                )}

                                owes

                                ${escapeHTML(
                                    creditor.name
                                )}

                            </strong>


                            <div class="expense-meta">

                                💵 Cash / E-Wallet Debt

                                <br>

                                Expense:
                                ${escapeHTML(
                                    debt.description
                                )}

                                <br>

                                Date:
                                ${escapeHTML(
                                    debt.date
                                )}

                            </div>

                        </div>


                        <div>

                            <span class="owe">

                                ${money(
                                    debt.amount
                                )}

                            </span>

                            <br><br>


                            <button
                                class="success small-btn"
                                onclick="toggleDebtPaid(
                                    '${escapeHTML(
                                        debt.expenseId
                                    )}',
                                    '${escapeHTML(
                                        debt.debtorId
                                    )}',
                                    '${escapeHTML(
                                        debt.creditorId
                                    )}'
                                )"
                            >

                                ✓ Mark Paid

                            </button>

                        </div>

                    </div>

                `;


                container.appendChild(
                    div
                );

            }
        );

    }


    /* =====================================================
       PAID DEBTS
    ===================================================== */

    if (
        paidDebts.length === 0
    ) {

        paidContainer.innerHTML = `

            <div class="empty">

                No paid debts yet.

            </div>

        `;

        return;

    }


    const INITIAL_PAID_DEBTS =
        3;


    /*
        Show the newest paid debts first.
    */

    const reversedPaidDebts =
        paidDebts
            .slice()
            .reverse();


    const visiblePaidDebts =
        reversedPaidDebts.slice(
            0,
            INITIAL_PAID_DEBTS
        );


    const hiddenPaidDebts =
        reversedPaidDebts.slice(
            INITIAL_PAID_DEBTS
        );


    /*
        Function that creates
        a paid debt card.
    */

    function createPaidDebtCard(
        debt
    ) {

        const debtor =
            getMember(
                debt.debtorId
            );


        const creditor =
            getMember(
                debt.creditorId
            );


        if (
            !debtor ||
            !creditor
        ) {

            return null;

        }


        const div =
            document.createElement(
                "div"
            );


        div.className =
            "debt-card";


        div.innerHTML = `

            <div class="debt-row">

                <div>

                    <strong>

                        ${escapeHTML(
                            debtor.name
                        )}

                        paid

                        ${escapeHTML(
                            creditor.name
                        )}

                    </strong>


                    <div class="expense-meta">

                        💵 Cash / E-Wallet Debt

                        <br>

                        Expense:
                        ${escapeHTML(
                            debt.description
                        )}

                        <br>

                        Date:
                        ${escapeHTML(
                            debt.date
                        )}

                        <br>

                        ✓ Payment completed

                    </div>

                </div>


                <div>

                    <span class="green">

                        ${money(
                            debt.amount
                        )}

                    </span>

                    <br><br>


                    <button
                        class="secondary small-btn"
                        onclick="toggleDebtPaid(
                            '${escapeHTML(
                                debt.expenseId
                            )}',
                            '${escapeHTML(
                                debt.debtorId
                            )}',
                            '${escapeHTML(
                                debt.creditorId
                            )}'
                        )"
                    >

                        ↩ Mark Unpaid

                    </button>

                </div>

            </div>

        `;


        return div;

    }


    /*
        Add first 3 paid debts.
    */

    visiblePaidDebts.forEach(
        debt => {

            const card =
                createPaidDebtCard(
                    debt
                );


            if (card) {

                paidContainer.appendChild(
                    card
                );

            }

        }
    );


    /*
        Add remaining paid debts
        inside hidden container.
    */

    if (
        hiddenPaidDebts.length > 0
    ) {

        const moreContainer =
            document.createElement(
                "div"
            );


        moreContainer.id =
            "morePaidDebts";


        moreContainer.style.display =
            "none";


        hiddenPaidDebts.forEach(
            debt => {

                const card =
                    createPaidDebtCard(
                        debt
                    );


                if (card) {

                    moreContainer.appendChild(
                        card
                    );

                }

            }
        );


        paidContainer.appendChild(
            moreContainer
        );


        const toggleButton =
            document.createElement(
                "button"
            );


        toggleButton.className =
            "secondary small-btn";


        toggleButton.style.marginTop =
            "12px";


        toggleButton.style.width =
            "100%";


        toggleButton.textContent =
            `View More (${hiddenPaidDebts.length}) ▼`;


        toggleButton.onclick =
            function() {

                const hidden =
                    moreContainer.style.display ===
                    "none";


                moreContainer.style.display =
                    hidden
                        ? "block"
                        : "none";


                toggleButton.textContent =
                    hidden
                        ? "Show Less ▲"
                        : `View More (${hiddenPaidDebts.length}) ▼`;

            };


        paidContainer.appendChild(
            toggleButton
        );

    }

}

/* =========================================================
   DEBT TAB SWITCHING
========================================================= */

function switchDebtTab(tab) {

    const activeTab =
        document.getElementById(
            "activeDebtsTab"
        );


    const paidTab =
        document.getElementById(
            "paidDebtsTab"
        );


    const activeContainer =
        document.getElementById(
            "debtsContainer"
        );


    const paidContainer =
        document.getElementById(
            "paidDebtsContainer"
        );


    if (
        !activeTab ||
        !paidTab ||
        !activeContainer ||
        !paidContainer
    ) {

        return;

    }


    /* =====================================================
       ACTIVE DEBTS
    ===================================================== */

    if (
        tab === "active"
    ) {

        activeTab.classList.add(
            "active"
        );

        paidTab.classList.remove(
            "active"
        );


        activeContainer.style.display =
            "block";

        paidContainer.style.display =
            "none";

    }


    /* =====================================================
       PAID HISTORY
    ===================================================== */

    else if (
        tab === "paid"
    ) {

        paidTab.classList.add(
            "active"
        );

        activeTab.classList.remove(
            "active"
        );


        activeContainer.style.display =
            "none";

        paidContainer.style.display =
            "block";

    }

}


/* =========================================================
   EXPENSE FILTERS
========================================================= */

function renderExpenseFilterMembers() {

    const select =
        document.getElementById(
            "expenseFilterMember"
        );


    if (!select)
        return;


    const old =
        select.value;


    select.innerHTML = `

        <option value="">
            Everyone
        </option>

    `;


    members.forEach(
        member => {

            select.appendChild(
                new Option(
                    member.name,
                    member.id
                )
            );

        }
    );


    if (
        memberExists(old)
    ) {

        select.value =
            old;

    }

}

function getFilteredExpenses() {

    const search =
        document.getElementById(
            "expenseSearch"
        ).value
            .trim()
            .toLowerCase();


    const category =
        document.getElementById(
            "expenseFilterCategory"
        ).value;


    const memberId =
        document.getElementById(
            "expenseFilterMember"
        ).value;


    const payment =
        document.getElementById(
            "expenseFilterPayment"
        ).value;


    const dateFrom =
        document.getElementById(
            "expenseFilterDateFrom"
        ).value;


    const dateTo =
        document.getElementById(
            "expenseFilterDateTo"
        ).value;


    return expenses.filter(
        expense => {

            /* =========================================
               SEARCH
            ========================================= */

            const matchesSearch =
                !search ||
                String(
                    expense.description || ""
                )
                    .toLowerCase()
                    .includes(search);


            /* =========================================
               CATEGORY
            ========================================= */

            const matchesCategory =
                !category ||
                expense.category === category;


            /* =========================================
               PAID BY
            ========================================= */

            const matchesMember =
                !memberId ||
                expense.paidById === memberId;


            /* =========================================
               PAYMENT
            ========================================= */

            const matchesPayment =
                !payment ||
                expense.paymentMethod === payment;


            /* =========================================
               DATE
            ========================================= */

            const expenseDate =
                String(
                    expense.date || ""
                ).slice(0, 10);


            const matchesDateFrom =
                !dateFrom ||
                expenseDate >= dateFrom;


            const matchesDateTo =
                !dateTo ||
                expenseDate <= dateTo;


            return (
                matchesSearch &&
                matchesCategory &&
                matchesMember &&
                matchesPayment &&
                matchesDateFrom &&
                matchesDateTo
            );

        }
    );

}


function clearExpenseFilters() {

    document.getElementById(
        "expenseSearch"
    ).value = "";


    document.getElementById(
        "expenseFilterCategory"
    ).value = "";


    document.getElementById(
        "expenseFilterMember"
    ).value = "";


    document.getElementById(
        "expenseFilterPayment"
    ).value = "";


    document.getElementById(
        "expenseFilterDateFrom"
    ).value = "";


    document.getElementById(
        "expenseFilterDateTo"
    ).value = "";


    renderExpenses();

}


/* =========================================================
   EXPENSE LIST
========================================================= */

function renderExpenses() {

    const container =
        document.getElementById(
            "expenseList"
        );


    container.innerHTML = "";


    const filtered =
        getFilteredExpenses();


    if (
        filtered.length === 0
    ) {

        container.innerHTML = `

            <div class="empty">

                No expenses match the
                current filters.

            </div>

        `;

        return;

    }


    /* =====================================================
       SORT NEWEST FIRST
    ===================================================== */

    const sorted =
        [...filtered]
            .sort(
                (
                    a,
                    b
                ) =>
                    new Date(
                        b.date
                    ) -
                    new Date(
                        a.date
                    )
            );


    /* =====================================================
       CHECK IF FILTERS ARE BEING USED
    ===================================================== */

    const search =
        document.getElementById(
            "expenseSearch"
        ).value
            .trim();


    const category =
        document.getElementById(
            "expenseFilterCategory"
        ).value;


    const memberId =
        document.getElementById(
            "expenseFilterMember"
        ).value;


    const payment =
        document.getElementById(
            "expenseFilterPayment"
        ).value;


    const dateFrom =
        document.getElementById(
            "expenseFilterDateFrom"
        ).value;


    const dateTo =
        document.getElementById(
            "expenseFilterDateTo"
        ).value;


    const hasFilters =
        search ||
        category ||
        memberId ||
        payment ||
        dateFrom ||
        dateTo;


    /* =====================================================
       INITIAL DISPLAY COUNT
    ===================================================== */

    const INITIAL_EXPENSES =
        3;


    let visibleExpenses;


    let hiddenExpenses;


    /*
        When filters are being used,
        show every matching result.

        When there are no filters,
        only show the newest 3.
    */

    if (
        hasFilters
    ) {

        visibleExpenses =
            sorted;

        hiddenExpenses = [];

    }
    else {

        visibleExpenses =
            sorted.slice(
                0,
                INITIAL_EXPENSES
            );

        hiddenExpenses =
            sorted.slice(
                INITIAL_EXPENSES
            );

    }


    /* =====================================================
       CREATE EXPENSE CARD
    ===================================================== */

    function createExpenseCard(
        expense
    ) {

        const card =
            getCardForExpense(
                expense
            );


        let splitHTML =
            "";


        members.forEach(
            member => {

                const share =
                    Number(
                        expense.splits?.[
                            member.id
                        ] || 0
                    );


                splitHTML += `

                    <span
                        style="
                            display:inline-block;
                            margin:
                                0 12px 8px 0;
                        "
                    >

                        ${escapeHTML(
                            member.name
                        )}:

                        <strong>

                            ${money(
                                share
                            )}

                        </strong>

                    </span>

                `;

            }
        );


        const div =
            document.createElement(
                "div"
            );


        div.className =
            "expense";


        div.innerHTML = `

            <div class="expense-top">

                <div>

                    <div class="expense-name">

                        ${escapeHTML(
                            expense.description
                        )}

                    </div>

<div class="expense-meta">

    ${formatDate(
        expense.date
    )}

    <span class="expense-dot">•</span>

    ${escapeHTML(
        expense.category
    )}

    <span class="expense-dot">•</span>

    ${getPaymentMethodName(
        expense.paymentMethod
    )}

</div>


<div class="expense-meta">

    Paid by:

    <strong>

        ${escapeHTML(
            getMemberName(
                expense.paidById
            )
        )}

    </strong>

</div>



                    ${
                        expense.paymentMethod ===
                        "credit_card"
                            ? `

                                <div class="expense-meta">

                                    Credit Card:

                                    <strong>

                                        ${
                                            card
                                                ? escapeHTML(
                                                    card.name
                                                )
                                                : "Missing Card"
                                        }

                                    </strong>

                                </div>

                            `
                            : ""
                    }

                </div>


                <div class="expense-amount">

                    ${money(
                        expense.amount
                    )}

                </div>

            </div>


            <div
                class="expense-meta"
                style="
                    margin-top:15px;
                "
            >

                <strong>
                    Split:
                </strong>

                <br><br>

                ${splitHTML}

            </div>


            <div class="expense-actions">

                <button
                    class="warning small-btn"
                    onclick="editExpense(
                        '${escapeHTML(
                            expense.id
                        )}'
                    )"
                >
                   <svg xmlns="http://www.w3.org/2000/svg" height="14" width="14" viewBox="0 20 640 640"><!--!Font Awesome Free v7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path fill="rgb(39, 39, 39)" d="M505 122.9L517.1 135C526.5 144.4 526.5 159.6 517.1 168.9L488 198.1L441.9 152L471 122.9C480.4 113.5 495.6 113.5 504.9 122.9zM273.8 320.2L408 185.9L454.1 232L319.8 366.2C316.9 369.1 313.3 371.2 309.4 372.3L250.9 389L267.6 330.5C268.7 326.6 270.8 323 273.7 320.1zM437.1 89L239.8 286.2C231.1 294.9 224.8 305.6 221.5 317.3L192.9 417.3C190.5 425.7 192.8 434.7 199 440.9C205.2 447.1 214.2 449.4 222.6 447L322.6 418.4C334.4 415 345.1 408.7 353.7 400.1L551 202.9C579.1 174.8 579.1 129.2 551 101.1L538.9 89C510.8 60.9 465.2 60.9 437.1 89zM152 128C103.4 128 64 167.4 64 216L64 488C64 536.6 103.4 576 152 576L424 576C472.6 576 512 536.6 512 488L512 376C512 362.7 501.3 352 488 352C474.7 352 464 362.7 464 376L464 488C464 510.1 446.1 528 424 528L152 528C129.9 528 112 510.1 112 488L112 216C112 193.9 129.9 176 152 176L264 176C277.3 176 288 165.3 288 152C288 138.7 277.3 128 264 128L152 128z"/></svg> Edit
                </button>


                <button
                    class="danger small-btn"
                    onclick="deleteExpense(
                        '${escapeHTML(
                            expense.id
                        )}'
                    )"
                >
                    🗑 Delete
                </button>

            </div>

        `;


        return div;

    }


    /* =====================================================
       RENDER FIRST 3
    ===================================================== */

    visibleExpenses.forEach(
        expense => {

            const card =
                createExpenseCard(
                    expense
                );


            container.appendChild(
                card
            );

        }
    );


    /* =====================================================
       HIDDEN EXPENSES
    ===================================================== */

    if (
        hiddenExpenses.length > 0
    ) {

        const moreContainer =
            document.createElement(
                "div"
            );


        moreContainer.id =
            "moreExpenses";


        moreContainer.style.display =
            "none";


        hiddenExpenses.forEach(
            expense => {

                const card =
                    createExpenseCard(
                        expense
                    );


                moreContainer.appendChild(
                    card
                );

            }
        );


        container.appendChild(
            moreContainer
        );


        /* =================================================
           SEE MORE BUTTON
        ================================================= */

        const toggleButton =
            document.createElement(
                "button"
            );


        toggleButton.className =
            "secondary small-btn";


        toggleButton.style.marginTop =
            "12px";


        toggleButton.style.width =
            "100%";


        toggleButton.textContent =
            `See More (${hiddenExpenses.length}) ▼`;


        toggleButton.onclick =
            function() {

                const hidden =
                    moreContainer.style.display ===
                    "none";


                moreContainer.style.display =
                    hidden
                        ? "block"
                        : "none";


                toggleButton.textContent =
                    hidden
                        ? "Show Less ▲"
                        : `See More (${hiddenExpenses.length}) ▼`;

            };


        container.appendChild(
            toggleButton
        );

    }

}


/* =========================================================
   OVERVIEW
   STEP 12.8.1 → EXPENSE-BASED DEBT TOTAL
========================================================= */

function calculateOutstandingDebt() {

    const debts =
        calculateDebts();


    let total = 0;


    debts.forEach(
        debt => {

            /*
                Only count unpaid debts.
            */

            if (
                !isDebtPaid(
                    debt.expenseId,
                    debt.debtorId,
                    debt.creditorId
                )
            ) {

                total +=
                    Number(
                        debt.amount || 0
                    );

            }

        }
    );


    return Number(
        total.toFixed(2)
    );

}

function renderOverview() {

    const total =
        expenses.reduce(
            (
                sum,
                expense
            ) =>
                sum +
                Number(
                    expense.amount ||
                    0
                ),
            0
        );


    document.getElementById(
        "totalGroupSpending"
    ).textContent =
        money(total);


    document.getElementById(
        "expenseCount"
    ).textContent =
        expenses.length;


    document.getElementById(
        "pendingPayments"
    ).textContent =
        money(
            calculatePendingPayments()
        );


    document.getElementById(
        "outstandingDebt"
    ).textContent =
        money(
            calculateOutstandingDebt()
        );

}


/* =========================================================
   COLLAPSIBLE SECTIONS
========================================================= */

function toggleSection(
    id
) {

    const section =
        document.getElementById(
            id
        );


    if (!section)
        return;


    const isHidden =
        section.style.display ===
        "none";


    section.style.display =
        isHidden
            ? "block"
            : "none";


    const map = {

        billsSection:
            "billsArrow",

        debtsSection:
            "debtsArrow",

        expensesSection:
            "expensesArrow"

    };


    const arrow =
        document.getElementById(
            map[id]
        );


    if (arrow) {

        arrow.textContent =
            isHidden
                ? "▼"
                : "▶";

    }

}


/* =========================================================
   EXPORT
========================================================= */

function exportData() {

    const data = {

        version: 4,

        members,

        creditCards,

        expenses,

        billPayments,

        debtPayments

    };


    const blob =
        new Blob(
            [
                JSON.stringify(
                    data,
                    null,
                    2
                )
            ],
            {
                type:
                    "application/json"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const a =
        document.createElement(
            "a"
        );


    a.href =
        url;


    a.download =
        "group-expense-backup-v4.json";


    document.body.appendChild(
        a
    );


    a.click();


    a.remove();


    URL.revokeObjectURL(
        url
    );

}


/* =========================================================
   IMPORT
========================================================= */

function importData(
    event
) {

    const file =
        event.target.files[0];


    if (!file)
        return;


    const reader =
        new FileReader();


    reader.onload =
        function(e) {

            try {

                const data =
                    JSON.parse(
                        e.target.result
                    );


                if (
                    !Array.isArray(
                        data.members
                    )
                ) {

                    throw new Error(
                        "Invalid backup file."
                    );

                }


                if (
                    !Array.isArray(
                        data.expenses
                    )
                ) {

                    throw new Error(
                        "The backup contains no expenses array."
                    );

                }


                if (
                    !confirm(
                        "Importing will replace your current data. Continue?"
                    )
                ) {

                    return;

                }


                /*
                    Determine whether this is
                    old name-based data.

                    Old:
                    members = ["You", "John"]

                    New:
                    members = [{id,name}]
                */

                if (
                    data.members.length &&
                    typeof data.members[0] ===
                    "string"
                ) {

                    migrateOldData({

                        members:
                            data.members,

                        creditCards:
                            data.creditCards ||
                            [],

                        expenses:
                            data.expenses,

                        billPayments:
                            data.billPayments ||
                            {},

                        debtPayments:
                            data.debtPayments ||
                            {}

                    });


                    renderAll();

                    renderSettings();

                    return;

                }


                /*
                    Modern import.
                */

                members =
                    data.members;


                creditCards =
                    data.creditCards ||
                    [];


                expenses =
                    data.expenses;


                billPayments =
                    data.billPayments ||
                    {};


                debtPayments =
                    data.debtPayments ||
                    {};


                normalizeData();

                saveAllData();

                resetExpenseForm();

                renderAll();

                renderSettings();


                alert(
                    "Data imported successfully."
                );

            }
            catch(error) {

                alert(
                    "Could not import this file.\n\n" +
                    error.message
                );

            }

        };


    reader.readAsText(
        file
    );


    event.target.value =
        "";

}


/* =========================================================
   RESET ALL DATA
========================================================= */

async function resetAllData() {

    if (!currentUser) {

        alert(
            "You are not logged in."
        );

        return;
    }


    if (!currentGroupId) {

        alert(
            "No expense group is currently selected."
        );

        return;
    }


    const confirmed =
        confirm(
            "This will permanently delete all expenses, " +
            "credit cards, bill payments, debt payments, " +
            "and payment statuses for this group.\n\n" +
            "Your group and members will NOT be deleted.\n\n" +
            "This action cannot be undone.\n\n" +
            "Are you sure?"
        );


    if (!confirmed) {
        return;
    }


    try {

        /*
            -------------------------------------------------
            1. DELETE DEBT PAYMENTS
            -------------------------------------------------
        */

        const {
            error: debtError
        } =
            await supabaseClient
                .from("debt_payments")
                .delete()
                .eq(
                    "group_id",
                    currentGroupId
                );


        if (debtError) {
            throw debtError;
        }


        /*
            -------------------------------------------------
            2. DELETE BILL PAYMENTS
            -------------------------------------------------
        */

        const {
            error: billPaymentError
        } =
            await supabaseClient
                .from("bill_payments")
                .delete()
                .eq(
                    "group_id",
                    currentGroupId
                );


        if (billPaymentError) {
            throw billPaymentError;
        }


        /*
            -------------------------------------------------
            3. DELETE CREDIT CARDS
            -------------------------------------------------
        */

        const {
            error: creditCardError
        } =
            await supabaseClient
                .from("credit_cards")
                .delete()
                .eq(
                    "group_id",
                    currentGroupId
                );


        if (creditCardError) {
            throw creditCardError;
        }


        /*
            -------------------------------------------------
            4. DELETE EXPENSES
            -------------------------------------------------

            expense_splits will automatically be deleted
            because expense_splits.expense_id has
            ON DELETE CASCADE.
        */

        const {
            error: expenseError
        } =
            await supabaseClient
                .from("expenses")
                .delete()
                .eq(
                    "group_id",
                    currentGroupId
                );


        if (expenseError) {
            throw expenseError;
        }


        /*
            -------------------------------------------------
            5. CLEAR LOCAL ARRAYS
            -------------------------------------------------
        */

        expenses = [];

        creditCards = [];

        billPayments = {};

        debtPayments = {};


        /*
            -------------------------------------------------
            6. RESET FORM
            -------------------------------------------------
        */

        resetExpenseForm();


        /*
            -------------------------------------------------
            7. REFRESH UI
            -------------------------------------------------
        */

        renderAll();

        renderSettings();


        alert(
            "All expense data has been permanently reset."
        );


        console.log(
            "Group data reset successfully:",
            currentGroupId
        );

    }
    catch (error) {

        console.error(
            "Could not reset group data:",
            error
        );

        alert(
            "Could not reset all data.\n\n" +
            error.message
        );

    }

}

/* =========================================================
   RENDER EVERYTHING
========================================================= */

function renderAll() {

    populateMemberDropdowns();

    populateCreditCardDropdown();

    renderOverview();

    renderMemberSummary();

    renderBills();

    renderDebts();

    renderExpenses();

}


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function() {

       /* Check authentication BEFORE initializing the application. */
     const authenticated = 
     await requireLogin(); 
     
     if (!authenticated) { 
        return; 
    } 
    
    /* User is authenticated. Continue loading the app. */ 
    
    const initialized =
     await initializeSupabaseApp(); 
     
     if (!initialized) { 
        console.error( 
            "Supabase initialization failed." 
        );
        
        return; 
    
    }


await loadSupabaseCreditCards();

        document.getElementById(
            "expenseDate"
        ).value =
            todayString();


        document.getElementById(
            "newCardName"
        ).addEventListener(
            "input",
            function() {

                this.value =
                    this.value.toUpperCase();

            }
        );


        document.getElementById(
            "amount"
        ).addEventListener(
            "input",
            function() {

                /*
                    If a split already exists,
                    recalculate equally when
                    the amount changes.
                */

                if (
                    Object.keys(
                        currentSplit
                    ).length > 0
                ) {

                    splitEqually();

                }

            }
        );


        document.getElementById(
            "paymentMethod"
        ).addEventListener(
            "change",
            updatePaymentMethodUI
        );


/* =====================================================
   EXPENSE FILTERS
===================================================== */

[
    "expenseSearch",
    "expenseFilterCategory",
    "expenseFilterMember",
    "expenseFilterPayment",
    "expenseFilterDateFrom",
    "expenseFilterDateTo"

].forEach(
    id => {

        const element =
            document.getElementById(
                id
            );


        if (!element)
            return;


        element.addEventListener(
            "input",
            renderExpenses
        );


        element.addEventListener(
            "change",
            renderExpenses
        );

    }
);


await loadSupabaseBillPayments();
await loadSupabaseDebtPayments();


        updatePaymentMethodUI();

        renderAll();

    }
);


/* =========================================================
   SETTINGS BACKDROP
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        document
            .getElementById(
                "settingsModal"
            )
            .addEventListener(
                "click",
                function(event) {

                    if (
                        event.target ===
                        this
                    ) {

                        closeSettings();

                    }

                }
            );

    }
);

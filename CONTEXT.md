# Kuartz Fashion Operations

Kuartz coordinates styling work between Clients and Vendors, from an initial expression of interest through production and delivery.

## Language

**Enquiry**:
A lightweight record for a person who has contacted Kuartz but has not yet agreed an Order. One person may have multiple open Enquiries.
_Avoid_: Lead, prospect, submission

**Client**:
A person whose agreed styling work is represented by one or more Orders. An Enquiry can be associated with an existing Client during conversion.
_Avoid_: Customer, account, user

**Active Order**:
Confirmed styling work for a Client with an agreed price, owner, and at least one Look. A Client may have multiple simultaneous Active Orders.
_Avoid_: Project, job, event

**Look**:
A named styling composition within an Order, optionally tied to a date, containing one or more Items.
_Avoid_: Event, moment

**Item**:
A specific garment or produced piece within a Look.
_Avoid_: Product, accessory

**Staff Member**:
An authenticated internal user belonging to a Kuartz Organization as either a Super Admin or Admin Assistant.
_Avoid_: Client user, account

**Super Admin**:
A Staff Member with organization, team, sensitive financial, override, and major deletion authority.

**Admin Assistant**:
A Staff Member who manages operational work but cannot perform authority reserved for a Super Admin.

**Archive**:
A reversible removal of a record from active operations without erasing its history.
_Avoid_: Delete

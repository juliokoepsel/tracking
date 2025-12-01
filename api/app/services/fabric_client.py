"""
Fabric Client Service
Handles all interactions with the Hyperledger Fabric network
"""
import json
import os
import subprocess
from typing import List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class FabricClient:
    """Client for interacting with Hyperledger Fabric network"""

    def __init__(self):
        self.channel_name = os.getenv("CHANNEL_NAME", "deliverychannel")
        self.chaincode_name = os.getenv("CHAINCODE_NAME", "delivery")
        self.org_msp_id = os.getenv("ORG_MSP_ID", "DeliveryOrgMSP")
        self.peer_address = os.getenv("PEER_ADDRESS", "peer0.delivery.example.com:7051")
        
        # Paths for crypto material
        self.msp_config_path = "/app/organizations/peerOrganizations/delivery.example.com/users/Admin@delivery.example.com/msp"
        self.orderer_address = os.getenv("ORDERER_ADDRESS", "orderer.example.com:7050")

    def _execute_peer_command(self, args: List[str]) -> Dict[str, Any]:
        """
        Execute a peer command and return the result
        
        Args:
            args: List of command arguments
            
        Returns:
            Dictionary with success status and data/error
        """
        try:
            # Execute via docker exec into the CLI container
            cmd = ["docker", "exec", "cli", "peer"] + args
            logger.info(f"Executing command: {' '.join(cmd)}")
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                logger.error(f"Command failed: {result.stderr}")
                return {
                    "success": False,
                    "error": result.stderr or "Command execution failed"
                }
            
            # Try to parse JSON response
            output = result.stdout.strip()
            logger.info(f"Command output: {output}")
            
            try:
                data = json.loads(output)
                return {"success": True, "data": data}
            except json.JSONDecodeError:
                # If not JSON, return as string
                return {"success": True, "data": output}
                
        except subprocess.TimeoutExpired:
            logger.error("Command timeout")
            return {"success": False, "error": "Command execution timeout"}
        except Exception as e:
            logger.error(f"Command execution error: {str(e)}")
            return {"success": False, "error": str(e)}

    def invoke_chaincode(self, function: str, args: List[str]) -> Dict[str, Any]:
        """
        Invoke a chaincode function
        
        Args:
            function: Function name to invoke
            args: Function arguments
            
        Returns:
            Dictionary with success status and data/error
        """
        # Format args as JSON object with Args array
        chaincode_args = {
            "function": function,
            "Args": args
        }
        args_json = json.dumps(chaincode_args)
        
        cmd_args = [
            "chaincode", "invoke",
            "-o", self.orderer_address,
            "-C", self.channel_name,
            "-n", self.chaincode_name,
            "-c", args_json,
            "--waitForEvent"
        ]
        
        return self._execute_peer_command(cmd_args)

    def query_chaincode(self, function: str, args: List[str]) -> Dict[str, Any]:
        """
        Query a chaincode function
        
        Args:
            function: Function name to query
            args: Function arguments
            
        Returns:
            Dictionary with success status and data/error
        """
        # Format args as JSON object with Args array
        chaincode_args = {
            "function": function,
            "Args": args
        }
        args_json = json.dumps(chaincode_args)
        
        cmd_args = [
            "chaincode", "query",
            "-C", self.channel_name,
            "-n", self.chaincode_name,
            "-c", args_json
        ]
        
        return self._execute_peer_command(cmd_args)

    # =====================
    # Delivery Operations
    # =====================

    def create_delivery(
        self,
        delivery_id: str,
        order_id: str,
        package_weight: float,
        dimension_length: float,
        dimension_width: float,
        dimension_height: float,
        location_city: str,
        location_state: str,
        location_country: str,
        caller_id: str,
        caller_role: str
    ) -> Dict[str, Any]:
        """
        Create a new delivery on the blockchain.
        Only SELLER can create deliveries.
        """
        args = [
            delivery_id,
            order_id,
            str(package_weight),
            str(dimension_length),
            str(dimension_width),
            str(dimension_height),
            location_city,
            location_state,
            location_country,
            caller_id,
            caller_role
        ]
        return self.invoke_chaincode("CreateDelivery", args)

    def read_delivery(self, delivery_id: str, caller_role: str) -> Dict[str, Any]:
        """
        Read a delivery from the blockchain.
        SELLER, CUSTOMER, and DELIVERY_PERSON can read.
        """
        return self.query_chaincode("ReadDelivery", [delivery_id, caller_role])

    def update_location(
        self,
        delivery_id: str,
        city: str,
        state: str,
        country: str,
        caller_id: str,
        caller_role: str
    ) -> Dict[str, Any]:
        """
        Update the last known location of a delivery.
        Only the current DELIVERY_PERSON custodian can update location.
        """
        args = [delivery_id, city, state, country, caller_id, caller_role]
        return self.invoke_chaincode("UpdateLocation", args)

    def cancel_delivery(
        self,
        delivery_id: str,
        caller_id: str,
        caller_role: str
    ) -> Dict[str, Any]:
        """
        Cancel a delivery.
        Only SELLER can cancel, and only before first handoff.
        """
        args = [delivery_id, caller_id, caller_role]
        return self.invoke_chaincode("CancelDelivery", args)

    # =====================
    # Handoff Operations
    # =====================

    def initiate_handoff(
        self,
        delivery_id: str,
        to_user_id: str,
        to_role: str,
        caller_id: str,
        caller_role: str
    ) -> Dict[str, Any]:
        """
        Initiate a custody handoff.
        SELLER or DELIVERY_PERSON can initiate handoffs.
        """
        args = [delivery_id, to_user_id, to_role, caller_id, caller_role]
        return self.invoke_chaincode("InitiateHandoff", args)

    def confirm_handoff(
        self,
        delivery_id: str,
        caller_id: str,
        caller_role: str
    ) -> Dict[str, Any]:
        """
        Confirm a pending custody handoff.
        DELIVERY_PERSON or CUSTOMER can confirm handoffs.
        """
        args = [delivery_id, caller_id, caller_role]
        return self.invoke_chaincode("ConfirmHandoff", args)

    def dispute_handoff(
        self,
        delivery_id: str,
        reason: str,
        caller_id: str,
        caller_role: str
    ) -> Dict[str, Any]:
        """
        Dispute a pending custody handoff.
        The intended recipient (DELIVERY_PERSON or CUSTOMER) can dispute.
        """
        args = [delivery_id, reason, caller_id, caller_role]
        return self.invoke_chaincode("DisputeHandoff", args)

    def cancel_handoff(
        self,
        delivery_id: str,
        caller_id: str,
        caller_role: str
    ) -> Dict[str, Any]:
        """
        Cancel a pending handoff.
        Only the initiator can cancel.
        """
        args = [delivery_id, caller_id, caller_role]
        return self.invoke_chaincode("CancelHandoff", args)

    # =====================
    # Query Operations
    # =====================

    def query_deliveries_by_custodian(
        self,
        custodian_id: str,
        caller_id: str,
        caller_role: str
    ) -> Dict[str, Any]:
        """
        Query all deliveries held by a specific user.
        Users can only query their own deliveries.
        """
        args = [custodian_id, caller_id, caller_role]
        return self.query_chaincode("QueryDeliveriesByCustodian", args)

    def query_deliveries_by_status(
        self,
        status: str,
        caller_id: str,
        caller_role: str
    ) -> Dict[str, Any]:
        """
        Query deliveries by status for the caller.
        Only returns deliveries where caller is the current custodian.
        """
        args = [status, caller_id, caller_role]
        return self.query_chaincode("QueryDeliveriesByStatus", args)

    def get_delivery_history(
        self,
        delivery_id: str,
        caller_role: str
    ) -> Dict[str, Any]:
        """
        Get the complete history of a delivery.
        SELLER, CUSTOMER, and DELIVERY_PERSON can view history.
        """
        args = [delivery_id, caller_role]
        return self.query_chaincode("GetDeliveryHistory", args)

    # =====================
    # Health Check
    # =====================

    def ping_blockchain(self) -> Dict[str, Any]:
        """
        Health check for blockchain connectivity.
        Attempts to check if delivery exists (simple query) to verify the network is accessible.
        """
        try:
            # Use DeliveryExists as a simple health check (doesn't need role)
            result = self.query_chaincode("DeliveryExists", ["health-check-dummy"])
            if result.get("success"):
                return {"success": True, "message": "Blockchain is accessible"}
            else:
                return {"success": False, "error": result.get("error", "Unknown error")}
        except Exception as e:
            return {"success": False, "error": str(e)}


# Singleton instance
fabric_client = FabricClient()

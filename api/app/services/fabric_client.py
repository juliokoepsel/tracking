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

    def create_delivery(
        self,
        tracking_id: str,
        sender_name: str,
        sender_address: str,
        recipient_name: str,
        recipient_address: str,
        package_weight: float,
        dimension_length: float,
        dimension_width: float,
        dimension_height: float,
        package_description: str,
        estimated_delivery_date: str,
        owner_id: str,
        owner_role: str
    ) -> Dict[str, Any]:
        """
        Create a new delivery on the blockchain with ownership
        """
        args = [
            tracking_id,
            sender_name,
            sender_address,
            recipient_name,
            recipient_address,
            str(package_weight),
            str(dimension_length),
            str(dimension_width),
            str(dimension_height),
            package_description,
            estimated_delivery_date,
            owner_id,
            owner_role
        ]
        return self.invoke_chaincode("CreateDelivery", args)

    def read_delivery(self, delivery_id: str) -> Dict[str, Any]:
        """Read a delivery from the blockchain"""
        return self.query_chaincode("ReadDelivery", [delivery_id])

    def update_delivery_with_ownership(
        self,
        delivery_id: str,
        recipient_address: str = "",
        delivery_status: str = "",
        caller_id: str = "",
        caller_role: str = ""
    ) -> Dict[str, Any]:
        """Update a delivery on the blockchain with ownership verification"""
        args = [delivery_id, recipient_address, delivery_status, caller_id, caller_role]
        return self.invoke_chaincode("UpdateDeliveryWithOwnership", args)

    def update_delivery_status(
        self,
        tracking_id: str,
        new_status: str,
        owner_id: str = "",
        owner_role: str = ""
    ) -> Dict[str, Any]:
        """Update delivery status with ownership verification"""
        return self.update_delivery_with_ownership(
            delivery_id=tracking_id,
            recipient_address="",
            delivery_status=new_status,
            caller_id=owner_id,
            caller_role=owner_role
        )

    def delete_delivery_with_ownership(
        self,
        delivery_id: str,
        caller_id: str,
        caller_role: str
    ) -> Dict[str, Any]:
        """Delete (cancel) a delivery with ownership verification"""
        args = [delivery_id, caller_id, caller_role]
        return self.invoke_chaincode("DeleteDeliveryWithOwnership", args)

    def query_all_deliveries(self) -> Dict[str, Any]:
        """Query all deliveries from the blockchain"""
        return self.query_chaincode("QueryAllDeliveries", [])

    def get_delivery_history(self, delivery_id: str) -> Dict[str, Any]:
        """Get the history of a delivery"""
        return self.query_chaincode("GetDeliveryHistory", [delivery_id])

    def query_deliveries_by_status(self, status: str) -> Dict[str, Any]:
        """Query deliveries by status"""
        return self.query_chaincode("QueryDeliveriesByStatus", [status])

    def query_deliveries_by_holder(self, holder_id: str) -> Dict[str, Any]:
        """Query deliveries by current holder"""
        return self.query_chaincode("QueryDeliveriesByHolder", [holder_id])

    # Chain of custody methods
    def initiate_handoff(
        self,
        delivery_id: str,
        from_user_id: str,
        from_role: str,
        to_user_id: str,
        to_role: str
    ) -> Dict[str, Any]:
        """Initiate a custody handoff"""
        args = [delivery_id, from_user_id, from_role, to_user_id, to_role]
        return self.invoke_chaincode("InitiateHandoff", args)

    def confirm_handoff(
        self,
        delivery_id: str,
        confirming_user_id: str
    ) -> Dict[str, Any]:
        """Confirm a pending custody handoff"""
        args = [delivery_id, confirming_user_id]
        return self.invoke_chaincode("ConfirmHandoff", args)

    def dispute_handoff(
        self,
        delivery_id: str,
        disputing_user_id: str,
        reason: str
    ) -> Dict[str, Any]:
        """Dispute a pending custody handoff"""
        args = [delivery_id, disputing_user_id, reason]
        return self.invoke_chaincode("DisputeHandoff", args)

    def cancel_handoff(
        self,
        delivery_id: str,
        cancelling_user_id: str
    ) -> Dict[str, Any]:
        """Cancel a pending custody handoff"""
        args = [delivery_id, cancelling_user_id]
        return self.invoke_chaincode("CancelHandoff", args)

    def ping_blockchain(self) -> Dict[str, Any]:
        """
        Health check for blockchain connectivity.
        Attempts to query the chaincode to verify the network is accessible.
        """
        try:
            # Query all deliveries as a simple health check
            result = self.query_chaincode("QueryAllDeliveries", [])
            if result.get("success"):
                return {"success": True, "message": "Blockchain is accessible"}
            else:
                return {"success": False, "error": result.get("error", "Unknown error")}
        except Exception as e:
            return {"success": False, "error": str(e)}


# Singleton instance
fabric_client = FabricClient()
